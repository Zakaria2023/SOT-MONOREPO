import { and, asc, desc, eq, getTableColumns, isNull, sql } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import { BoqItems, Boqs } from "../../../db/schema/boqs";
import { HandoverAssets, HandoverPacks } from "../../../db/schema/handovers";
import { Products, type SelectProducts } from "../../../db/schema/products";
import {
  SpaceItems,
  Spaces,
  type SelectSpaceItems,
  type SelectSpaces,
} from "../../../db/schema/spaces";
import { Users, type SelectUsers } from "../../../db/schema/users";
import { ConflictError, ValidationError } from "./errors";
import { notify } from "./notifications";
import type { DbExecutor } from "./partners";
import {
  checkItemIdentity,
  summariseRegister,
  type RegisterSummary,
} from "./space-register";

export type { SelectSpaceItems, SelectSpaces };

// ---------------------------------------------------------------------------
// 6.1 — THE POST-PURCHASE OBJECT.
//
// A Space is a building the customer owns, and the register of what is installed
// in it. It is the first object in this system that is not a transaction: it has
// no status, it never completes, and it is still there in eight years when a CO
// sensor rated for ten reaches the end of its life.
//
// THE HARD PART IS NOT THE TABLE, IT IS GETTING IT FILLED. A register that
// depends on somebody typing an inventory is a register that stays empty, and an
// empty one is worse than none because every question asked of it comes back
// "nothing installed" — which reads as an answer. So a Space is populated from the
// handover, at the moment SOT verifies the job, from the as-built assets the
// partner already had to record to get paid.
//
// Ownership is checked in every read. There is no admin-wide list here on
// purpose: a Space is somebody's home or office, its register says exactly which
// locks and cameras are fitted and where, and that is not a thing to leave behind
// a function that forgets to ask whose it is.
// ---------------------------------------------------------------------------

export type SpaceWithSummary = SelectSpaces & {
  summary: RegisterSummary;
};

export type SpaceItemDetail = SelectSpaceItems & {
  // Live catalogue facts, for the surfaces that want to link to the product or
  // show what it is now called. Null once a product leaves the catalogue — which
  // is exactly why the item snapshots its own `name`.
  productSlug: SelectProducts["slug"] | null;
  productImage: SelectProducts["image"] | null;
  productStatus: SelectProducts["status"] | null;
};

export type SpaceDetail = {
  space: SelectSpaces;
  items: SpaceItemDetail[];
  summary: RegisterSummary;
};

export type CreateSpaceInput = {
  userUuid: string;
  name: string;
  address?: SelectSpaces["address"];
  notes?: string | null;
};

/** Register a site. */
export const createSpace = async (
  input: CreateSpaceInput,
): Promise<SelectSpaces> => {
  const name = input.name.trim();
  if (name === "") {
    throw new ValidationError("A space needs a name you will recognise later.");
  }

  const uuid = generateUuid();
  await db.insert(Spaces).values({
    uuid,
    userUuid: input.userUuid,
    name,
    address: input.address ?? null,
    notes: input.notes?.trim() || null,
  });

  const [space] = await db.select().from(Spaces).where(eq(Spaces.uuid, uuid));
  if (!space) {
    throw new Error("Failed to create that space");
  }
  return space;
};

/**
 * This customer's sites, each with its register totalled.
 *
 * Two queries rather than one per space. A list of five sites doing a count each
 * is six round trips for a page nobody reads twice, and the connection ceiling is
 * shared across five apps.
 */
export const listSpaces = async (
  userUuid: string,
): Promise<SpaceWithSummary[]> => {
  const spaces = await db
    .select()
    .from(Spaces)
    .where(eq(Spaces.userUuid, userUuid))
    .orderBy(asc(Spaces.name));
  if (spaces.length === 0) {
    return [];
  }

  const items = await db
    .select()
    .from(SpaceItems)
    .innerJoin(Spaces, eq(SpaceItems.spaceUuid, Spaces.uuid))
    .where(eq(Spaces.userUuid, userUuid));

  const bySpace = new Map<string, SelectSpaceItems[]>();
  for (const row of items) {
    const list = bySpace.get(row.SpaceItems.spaceUuid) ?? [];
    list.push(row.SpaceItems);
    bySpace.set(row.SpaceItems.spaceUuid, list);
  }

  return spaces.map((space) => ({
    ...space,
    summary: summariseRegister(bySpace.get(space.uuid) ?? []),
  }));
};

/** One site and its register, but only if this customer owns it. */
export const getSpace = async (
  userUuid: string,
  spaceUuid: string,
): Promise<SpaceDetail | null> => {
  const [space] = await db
    .select()
    .from(Spaces)
    .where(and(eq(Spaces.uuid, spaceUuid), eq(Spaces.userUuid, userUuid)));
  if (!space) {
    return null;
  }

  const items = await db
    .select({
      ...getTableColumns(SpaceItems),
      productSlug: Products.slug,
      productImage: Products.image,
      productStatus: Products.status,
    })
    .from(SpaceItems)
    .leftJoin(Products, eq(SpaceItems.productUuid, Products.uuid))
    // Retired units last rather than hidden. They are the history that explains
    // the next callout — "this is the third one of these to fail" is not
    // answerable from a list that forgets.
    .orderBy(asc(SpaceItems.retiredAt), asc(SpaceItems.location))
    .where(eq(SpaceItems.spaceUuid, spaceUuid));

  return { space, items, summary: summariseRegister(items) };
};

/**
 * Pin the site on the map.
 *
 * Coordinates are validated rather than trusted. A swapped pair — Riyadh's
 * 24.7, 46.7 entered as 46.7, 24.7 — is a perfectly valid-looking point in the
 * Black Sea, and the only defence against it at this layer is refusing anything
 * outside the real ranges. Latitude past ±90 is not a place.
 *
 * Merged into the existing address rather than replacing it, because the pin and
 * the written address are two answers to the same question and losing one to set
 * the other would make the map a downgrade.
 */
export const setSpaceLocation = async ({
  userUuid,
  spaceUuid,
  latitude,
  longitude,
}: {
  userUuid: string;
  spaceUuid: string;
  // Null clears the pin, which has to stay possible — a pin dropped in the wrong
  // country is worse than none.
  latitude: number | null;
  longitude: number | null;
}): Promise<SelectSpaces> => {
  const space = await ownedSpace(userUuid, spaceUuid);

  const clearing = latitude === null || longitude === null;
  if (!clearing) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new ValidationError("That is not a point on the map.");
    }
    if (latitude < -90 || latitude > 90) {
      throw new ValidationError("Latitude has to be between -90 and 90.");
    }
    if (longitude < -180 || longitude > 180) {
      throw new ValidationError("Longitude has to be between -180 and 180.");
    }
  }

  await db
    .update(Spaces)
    .set({
      address: {
        ...(space.address ?? {}),
        latitude: clearing ? undefined : latitude,
        longitude: clearing ? undefined : longitude,
      },
    })
    .where(eq(Spaces.uuid, spaceUuid));

  const [updated] = await db
    .select()
    .from(Spaces)
    .where(eq(Spaces.uuid, spaceUuid));
  if (!updated) {
    throw new Error("Failed to save that location");
  }
  return updated;
};

export type AddSpaceItemInput = {
  userUuid: string;
  spaceUuid: string;
  productUuid?: string | null;
  name: string;
  quantity?: number;
  location?: string | null;
  installedAt?: string | null;
  serial?: string | null;
  macAddress?: string | null;
  notes?: string | null;
  boqUuid?: string | null;
};

const ownedSpace = async (
  userUuid: string,
  spaceUuid: string,
): Promise<SelectSpaces> => {
  const [space] = await db
    .select()
    .from(Spaces)
    .where(and(eq(Spaces.uuid, spaceUuid), eq(Spaces.userUuid, userUuid)));
  if (!space) {
    // The same message whether it does not exist or belongs to somebody else.
    // Distinguishing them tells an outsider which uuids are real.
    throw new ValidationError("That space could not be found.");
  }
  return space;
};

/** Add something to the register by hand. */
export const addSpaceItem = async (
  input: AddSpaceItemInput,
): Promise<SelectSpaceItems> => {
  await ownedSpace(input.userUuid, input.spaceUuid);

  const name = input.name.trim();
  if (name === "") {
    throw new ValidationError("An item needs a name.");
  }

  const quantity = input.quantity ?? 1;
  // The batch-or-device rule, from the one place it is written down. Firmware is
  // never set here — it is declared separately, because declaring it has to
  // record who said so.
  const identity = checkItemIdentity({
    quantity,
    serial: input.serial ?? null,
    macAddress: input.macAddress ?? null,
    firmwareVersion: null,
  });
  if (!identity.ok) {
    throw new ValidationError(identity.reason);
  }

  const uuid = generateUuid();
  await db.insert(SpaceItems).values({
    uuid,
    spaceUuid: input.spaceUuid,
    productUuid: input.productUuid ?? null,
    name,
    quantity,
    location: input.location?.trim() || null,
    installedAt: input.installedAt ?? null,
    serial: input.serial?.trim() || null,
    macAddress: input.macAddress?.trim() || null,
    notes: input.notes?.trim() || null,
    boqUuid: input.boqUuid ?? null,
  });

  const [item] = await db
    .select()
    .from(SpaceItems)
    .where(eq(SpaceItems.uuid, uuid));
  if (!item) {
    throw new Error("Failed to add that item");
  }
  return item;
};

/**
 * Record what firmware somebody believes a device is running.
 *
 * `firmwareVerified` is NOT set here, and cannot be from this function. That is
 * the whole design: the customer is telling us what they read off a screen, and a
 * number SOT records as verified because somebody typed it confidently is a lie
 * the rules engine would then act on.
 *
 * The declaring party is recorded, because an unverified number with no author
 * cannot even be chased up.
 */
export const declareFirmware = async ({
  userUuid,
  itemUuid,
  version,
  declaredBy,
}: {
  userUuid: string;
  itemUuid: string;
  version: string;
  declaredBy: string;
}): Promise<SelectSpaceItems> => {
  const [row] = await db
    .select({ item: getTableColumns(SpaceItems), ownerUuid: Spaces.userUuid })
    .from(SpaceItems)
    .innerJoin(Spaces, eq(SpaceItems.spaceUuid, Spaces.uuid))
    .where(eq(SpaceItems.uuid, itemUuid));
  if (!row || row.ownerUuid !== userUuid) {
    throw new ValidationError("That item could not be found.");
  }

  const trimmed = version.trim();
  if (trimmed === "") {
    throw new ValidationError("Enter the firmware version shown on the device.");
  }

  // A batch cannot carry a firmware version — see space-register.ts. Checked here
  // as well as at insert because quantity and firmware arrive at different times.
  const identity = checkItemIdentity({
    quantity: row.item.quantity,
    serial: row.item.serial,
    macAddress: row.item.macAddress,
    firmwareVersion: trimmed,
  });
  if (!identity.ok) {
    throw new ValidationError(identity.reason);
  }

  await db
    .update(SpaceItems)
    .set({
      firmwareVersion: trimmed,
      // Reset on every re-declaration. A version that was verified last year is
      // not evidence about the number typed today, and carrying the flag forward
      // would silently promote hearsay to a verified fact.
      firmwareVerified: false,
      firmwareDeclaredBy: declaredBy,
      firmwareDeclaredAt: new Date(),
    })
    .where(eq(SpaceItems.uuid, itemUuid));

  const [updated] = await db
    .select()
    .from(SpaceItems)
    .where(eq(SpaceItems.uuid, itemUuid));
  if (!updated) {
    throw new Error("Failed to record that firmware version");
  }
  return updated;
};

/**
 * SOT confirms a firmware version it has actually seen.
 *
 * Separate function, no customer path to it, and it refuses when there is nothing
 * declared — verifying a blank is how a check with no subject ends up marked
 * confirmed. Only after this may a firmware rule block rather than warn.
 */
export const verifyFirmware = async (
  itemUuid: string,
  verifiedBy: string,
): Promise<SelectSpaceItems> => {
  const [item] = await db
    .select()
    .from(SpaceItems)
    .where(eq(SpaceItems.uuid, itemUuid));
  if (!item) {
    throw new ValidationError("That item could not be found.");
  }
  if (item.firmwareVersion === null) {
    throw new ConflictError(
      "There is no firmware version on this item to verify.",
    );
  }

  await db
    .update(SpaceItems)
    .set({ firmwareVerified: true, firmwareDeclaredBy: verifiedBy })
    .where(eq(SpaceItems.uuid, itemUuid));

  const [updated] = await db
    .select()
    .from(SpaceItems)
    .where(eq(SpaceItems.uuid, itemUuid));
  if (!updated) {
    throw new Error("Failed to verify that firmware version");
  }
  return updated;
};

/** Take a unit out of service without losing that it was ever there. */
export const retireSpaceItem = async ({
  userUuid,
  itemUuid,
  reason,
}: {
  userUuid: string;
  itemUuid: string;
  reason: string;
}): Promise<void> => {
  if (reason.trim() === "") {
    throw new ValidationError(
      "Say why it came out — that reason is what explains the next failure.",
    );
  }

  const [row] = await db
    .select({ uuid: SpaceItems.uuid, ownerUuid: Spaces.userUuid })
    .from(SpaceItems)
    .innerJoin(Spaces, eq(SpaceItems.spaceUuid, Spaces.uuid))
    .where(and(eq(SpaceItems.uuid, itemUuid), isNull(SpaceItems.retiredAt)));
  if (!row || row.ownerUuid !== userUuid) {
    throw new ValidationError("That item could not be found.");
  }

  await db
    .update(SpaceItems)
    .set({ retiredAt: new Date(), retiredReason: reason.trim() })
    .where(eq(SpaceItems.uuid, itemUuid));
};

/**
 * Fill the register from a verified handover.
 *
 * THE FUNCTION THAT MAKES THE TABLE WORTH HAVING. Called from `verifyHandover`,
 * inside its transaction, so the moment SOT accepts an installation the customer's
 * site register gains what was installed. Nobody types an inventory.
 *
 * It reads the BOQ LINES for the product link and the handover ASSETS for install
 * reality, because neither alone is enough: an asset row has the serial and the
 * location but only a free-text make/model, and a BOQ line has the product uuid
 * the rules engine needs but no idea where the unit ended up.
 *
 * Idempotent by (space, boq). Verification can be re-run after a dispute, and a
 * register that gains a second copy of every camera each time is worse than one
 * that gained nothing.
 */
export const adoptHandoverIntoSpace = async (
  executor: DbExecutor,
  { boqUuid, spaceUuid }: { boqUuid: string; spaceUuid: string },
): Promise<number> => {
  const existing = await executor
    .select({ uuid: SpaceItems.uuid })
    .from(SpaceItems)
    .where(
      and(eq(SpaceItems.spaceUuid, spaceUuid), eq(SpaceItems.boqUuid, boqUuid)),
    );
  if (existing.length > 0) {
    return 0;
  }

  const lines = await executor
    .select({
      itemUuid: BoqItems.uuid,
      productUuid: BoqItems.productUuid,
      name: BoqItems.name,
      quantity: BoqItems.quantity,
    })
    .from(BoqItems)
    .where(eq(BoqItems.boqUuid, boqUuid));

  const assets = await executor
    .select({
      boqItemUuid: HandoverAssets.boqItemUuid,
      name: HandoverAssets.name,
      location: HandoverAssets.location,
      serialNumber: HandoverAssets.serialNumber,
      macAddress: HandoverAssets.macAddress,
    })
    .from(HandoverAssets)
    .innerJoin(
      HandoverPacks,
      eq(HandoverAssets.packUuid, HandoverPacks.uuid),
    )
    .where(eq(HandoverPacks.boqUuid, boqUuid));

  const assetsByLine = new Map<string, typeof assets>();
  for (const asset of assets) {
    if (asset.boqItemUuid === null) {
      continue;
    }
    const list = assetsByLine.get(asset.boqItemUuid) ?? [];
    list.push(asset);
    assetsByLine.set(asset.boqItemUuid, list);
  }

  const installedAt = new Date().toISOString().slice(0, 10);
  const rows: (typeof SpaceItems.$inferInsert)[] = [];

  for (const line of lines) {
    // A line with no product is labour, and labour does not go on a register of
    // equipment.
    if (line.productUuid === null) {
      continue;
    }

    const matched = assetsByLine.get(line.itemUuid) ?? [];

    if (matched.length === 0) {
      // No as-built detail: one batch row carrying the count. Honest — we know
      // what went in and not which unit is where.
      rows.push({
        uuid: generateUuid(),
        spaceUuid,
        productUuid: line.productUuid,
        name: line.name,
        quantity: line.quantity,
        installedAt,
        boqUuid,
      });
      continue;
    }

    // One row per identified device, because each asset carries its own serial and
    // location. This is the batch-or-device rule falling out of the data rather
    // than being imposed on it.
    for (const asset of matched) {
      rows.push({
        uuid: generateUuid(),
        spaceUuid,
        productUuid: line.productUuid,
        name: asset.name || line.name,
        quantity: 1,
        location: asset.location,
        serial: asset.serialNumber,
        macAddress: asset.macAddress,
        installedAt,
        boqUuid,
      });
    }

    // Fewer assets recorded than units ordered: the remainder still went in, and
    // dropping them would leave the register short of what the customer paid for.
    const remainder = line.quantity - matched.length;
    if (remainder > 0) {
      rows.push({
        uuid: generateUuid(),
        spaceUuid,
        productUuid: line.productUuid,
        name: line.name,
        quantity: remainder,
        installedAt,
        boqUuid,
      });
    }
  }

  if (rows.length === 0) {
    return 0;
  }

  await executor.insert(SpaceItems).values(rows);
  return rows.length;
};

/**
 * The Space a handover should populate: the one the BOQ was for, or a new one
 * named after the site.
 *
 * A first-time customer has no Space, and asking them to create one before they
 * can be given their own installation record would leave the common case empty.
 * So one is created from the site they typed when they built the BOQ.
 */
export const resolveSpaceForBoq = async (
  executor: DbExecutor,
  boqUuid: string,
): Promise<string | null> => {
  const [boq] = await executor
    .select({
      uuid: Boqs.uuid,
      userUuid: Boqs.userUuid,
      site: Boqs.site,
      reference: Boqs.reference,
      spaceUuid: Boqs.spaceUuid,
    })
    .from(Boqs)
    .where(eq(Boqs.uuid, boqUuid));
  if (!boq) {
    return null;
  }
  if (boq.spaceUuid !== null) {
    return boq.spaceUuid;
  }

  const uuid = generateUuid();
  await executor.insert(Spaces).values({
    uuid,
    userUuid: boq.userUuid,
    // Their words where they gave any. `site` is what they typed while shopping,
    // and it is the phrase they will recognise in a list.
    name: boq.site?.trim() || `Site for ${boq.reference}`,
  });

  await executor
    .update(Boqs)
    .set({ spaceUuid: uuid })
    .where(eq(Boqs.uuid, boqUuid));

  return uuid;
};

/** Tell the customer their site register now exists. */
export const announceSpace = async (
  clerkUserId: string | null,
  spaceName: string,
  itemCount: number,
): Promise<void> => {
  if (clerkUserId === null || itemCount === 0) {
    return;
  }
  await notify({
    audience: "client",
    kind: "boq_status",
    recipientClerkUserId: clerkUserId,
    title: `${spaceName} now lists your installed equipment`,
    body: `${itemCount} ${itemCount === 1 ? "entry" : "entries"} added from your handover. Replacement dates and service history run from here.`,
    href: "/spaces",
  });
};

export type StaffSpaceRow = SelectSpaces & {
  ownerName: SelectUsers["fullName"] | null;
  // Aggregates — no single column backs them.
  units: number;
  // The number that decides whether a firmware rule can gate anything at this
  // site. Surfaced on the list so it is findable, not buried one click in.
  unverifiedFirmware: number;
};

/**
 * Every space, for support — with the count of firmware versions nobody has
 * checked.
 *
 * Aggregated in SQL rather than by loading each register: one row per space, not
 * one query per space. A support list that fans out is the shape that takes the
 * shared connection pool down.
 */
export const listAllSpaces = async (): Promise<StaffSpaceRow[]> =>
  db
    .select({
      ...getTableColumns(Spaces),
      ownerName: Users.fullName,
      units: sql<number>`COALESCE((
        SELECT SUM(${SpaceItems.quantity}) FROM ${SpaceItems}
        WHERE ${SpaceItems.spaceUuid} = ${Spaces.uuid}
          AND ${SpaceItems.retiredAt} IS NULL
      ), 0)`.mapWith(Number),
      unverifiedFirmware: sql<number>`COALESCE((
        SELECT COUNT(*) FROM ${SpaceItems}
        WHERE ${SpaceItems.spaceUuid} = ${Spaces.uuid}
          AND ${SpaceItems.retiredAt} IS NULL
          AND ${SpaceItems.firmwareVersion} IS NOT NULL
          AND ${SpaceItems.firmwareVerified} = false
      ), 0)`.mapWith(Number),
    })
    .from(Spaces)
    .leftJoin(Users, eq(Spaces.userUuid, Users.uuid))
    .orderBy(desc(Spaces.createdAt));

/**
 * One space and its register, unscoped — for staff answering a support call.
 *
 * Separate from `getSpace` rather than a flag on it. A boolean that switches the
 * ownership check off is one mistaken `true` away from serving a customer somebody
 * else's site register, and this way the unscoped read is something a caller has
 * to name.
 */
export const getSpaceForStaff = async (
  spaceUuid: string,
): Promise<SpaceDetail | null> => {
  const [space] = await db
    .select()
    .from(Spaces)
    .where(eq(Spaces.uuid, spaceUuid));
  if (!space) {
    return null;
  }

  const items = await db
    .select({
      ...getTableColumns(SpaceItems),
      productSlug: Products.slug,
      productImage: Products.image,
      productStatus: Products.status,
    })
    .from(SpaceItems)
    .leftJoin(Products, eq(SpaceItems.productUuid, Products.uuid))
    .orderBy(asc(SpaceItems.retiredAt), asc(SpaceItems.location))
    .where(eq(SpaceItems.spaceUuid, spaceUuid));

  return { space, items, summary: summariseRegister(items) };
};
