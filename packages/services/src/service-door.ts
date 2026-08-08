import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import type { ServiceRequestKind } from "../../../db/enum";
import { Products } from "../../../db/schema/products";
import {
  ServiceRequests,
  type SelectServiceRequests,
} from "../../../db/schema/service-requests";
import {
  SpaceItems,
  Spaces,
  type SelectSpaceItems,
  type SelectSpaces,
} from "../../../db/schema/spaces";
import { Users, type SelectUsers } from "../../../db/schema/users";
import { getCart } from "./cart";
import { gateSelection, type GateDecision } from "./design-check";
import { ConflictError, ValidationError } from "./errors";
import { notify } from "./notifications";
import {
  buildSchedule,
  earliestDue,
  hasUnknown,
  warrantyState,
  type ScheduleEntry,
  type WarrantyState,
} from "./service-schedule";

export type { SelectServiceRequests };

// ---------------------------------------------------------------------------
// 6.2 — THE SERVICE DOOR.
//
// The screen that makes SOT a platform rather than a shop, and the one thing here
// that no competitor's checkout can copy: it is built entirely out of facts that
// only exist because the sale, the install and the handover all happened in one
// place.
//
// Four things, and they are four because they answer four different questions:
//
//   WHEN IS THIS DUE?     from the install date and the product's rated lives.
//   WHO PAYS?             warranty, which is not the same question and must never
//                         be folded into the first one.
//   WILL THIS FIT?        adding to a system that already exists, judged against
//                         what is actually installed rather than against an empty
//                         room.
//   COME AND LOOK AT IT.  a callout, carrying the reason the schedule gave.
//
// The specification keys are read by KEY here, which is the one place in this
// codebase that is allowed to. Everything else keys attributes by uuid precisely
// so a renamed label cannot orphan a value — but these three lives are named in
// the roadmap by key, they are stable, and the alternative is hard-coding three
// uuids that mean nothing to anybody reading this later. A missing key produces
// `unknown`, which is the safe outcome, so a rename degrades to "we do not know"
// rather than to a wrong date.
// ---------------------------------------------------------------------------

// The attributes the schedule is built from. Named rather than configured: these
// three are what a service life IS, and a settings screen for them would be a
// setting nobody could answer.
const LIFE_KEYS = {
  serviceLifeYears: "sys.service_life_years",
  sensorLifeYears: "sys.sensor_life_years",
  batteryLifeYears: "pwr.battery_life_years",
  warrantyMonths: "id.warranty_months",
} as const;

export type ServiceItem = {
  itemUuid: string;
  name: string;
  location: string | null;
  installedAt: string | null;
  productUuid: string | null;
  schedule: ScheduleEntry[];
  // The earliest real date across the three clocks — the one worth showing.
  next: ScheduleEntry | null;
  // True when at least one clock could not be worked out. Carried separately so a
  // screen cannot read "nothing due" off an item nobody has filled in.
  incomplete: boolean;
  warranty: WarrantyState;
};

export type ServiceView = {
  items: ServiceItem[];
  // Counts for the header. Aggregates, so plain numbers.
  overdue: number;
  dueSoon: number;
  // Items for which no date could be worked out AT ALL — see the note where this
  // is computed for why it is not "items with any unknown clock".
  unschedulable: number;
};

const numberFrom = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  // A number stored as a string is a real case in this catalogue — `warranty_period`
  // holds "24". Parsed rather than rejected, but only when the whole string is a
  // number: "24 months" must not silently become 24 through parseFloat, because
  // then "2-year" would become 2.
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
};

/**
 * Everything the service door needs for one site.
 *
 * Two queries: the register, and the four attributes for every product in it. Not
 * one read per item — a site with sixty detectors would be sixty round trips
 * against a connection pool five apps share.
 */
export const getServiceView = async (
  userUuid: string,
  spaceUuid: string,
  today: string,
): Promise<ServiceView | null> => {
  const [space] = await db
    .select({ uuid: Spaces.uuid })
    .from(Spaces)
    .where(and(eq(Spaces.uuid, spaceUuid), eq(Spaces.userUuid, userUuid)));
  if (!space) {
    return null;
  }

  const rows = await db
    .select({
      ...getTableColumns(SpaceItems),
      // Only the four values, pulled out of the JSON by key. Never the whole
      // `spec_values` column — dragging a blob across the wire per row to read
      // three numbers is how a list page gets slow without anybody noticing.
      serviceLife: sql<
        string | null
      >`JSON_UNQUOTE(JSON_EXTRACT(${Products.specValues}, ${`$."${LIFE_KEYS.serviceLifeYears}"`}))`,
      sensorLife: sql<
        string | null
      >`JSON_UNQUOTE(JSON_EXTRACT(${Products.specValues}, ${`$."${LIFE_KEYS.sensorLifeYears}"`}))`,
      batteryLife: sql<
        string | null
      >`JSON_UNQUOTE(JSON_EXTRACT(${Products.specValues}, ${`$."${LIFE_KEYS.batteryLifeYears}"`}))`,
      warrantyMonths: sql<
        string | null
      >`JSON_UNQUOTE(JSON_EXTRACT(${Products.specValues}, ${`$."${LIFE_KEYS.warrantyMonths}"`}))`,
      // The legacy column, as a fallback. Two places have held a warranty since
      // before the specification library existed; the library is authoritative and
      // this catches the products nobody has migrated.
      warrantyPeriod: Products.warrantyPeriod,
    })
    .from(SpaceItems)
    .leftJoin(Products, eq(SpaceItems.productUuid, Products.uuid))
    // Retired units have no future. Excluded from the schedule rather than shown
    // as overdue forever.
    .where(eq(SpaceItems.spaceUuid, spaceUuid));

  const items: ServiceItem[] = rows
    .filter((row) => row.retiredAt === null)
    .map((row) => {
      const schedule = buildSchedule({
        installedAt: row.installedAt,
        life: {
          serviceLifeYears: numberFrom(row.serviceLife),
          sensorLifeYears: numberFrom(row.sensorLife),
          batteryLifeYears: numberFrom(row.batteryLife),
        },
        today,
      });

      return {
        itemUuid: row.uuid,
        name: row.name,
        location: row.location,
        installedAt: row.installedAt,
        productUuid: row.productUuid,
        schedule,
        next: earliestDue(schedule),
        incomplete: hasUnknown(schedule),
        warranty: warrantyState({
          installedAt: row.installedAt,
          warrantyMonths:
            numberFrom(row.warrantyMonths) ?? numberFrom(row.warrantyPeriod),
          today,
        }),
      };
    });

  return {
    items,
    overdue: items.filter((item) => item.next?.status === "overdue").length,
    dueSoon: items.filter((item) => item.next?.status === "due_soon").length,
    // Items with NO date at all — nothing could be scheduled for them.
    //
    // Not "items with any unknown clock", which is what this counted first and was
    // wrong. Almost every real product has a rated service life and no stated
    // battery figure, so that version reported four out of four items as undated
    // while three of them had perfectly good sensor dates. A counter that is always
    // at maximum is a counter nobody reads, and it was hiding the one item that
    // genuinely had nothing.
    //
    // The per-clock gaps are still visible — every row lists all three with its own
    // reason, and `incomplete` is on the item for anything that wants it.
    unschedulable: items.filter((item) => item.next === null).length,
  };
};

// ---------------------------------------------------------------------------
// Adding to a system that already exists.
// ---------------------------------------------------------------------------

export type AdditionCheck = {
  gate: GateDecision;
  // What was already there, and therefore counted against the capacity the new
  // lines want. Returned so a screen can say WHY something failed — "the switch is
  // already carrying six cameras" is the useful half of the answer.
  existing: { productUuid: string; name: string; quantity: number }[];
};

/**
 * Judge new lines against what is already installed.
 *
 * THE WHOLE POINT IS THE UNION. Running the engine over the four new cameras alone
 * would pass them happily — four cameras need one switch and any switch will do.
 * Run against the register, the same four cameras go onto a switch that is already
 * carrying six, and the PoE budget is the answer. A design check that ignores the
 * building is a design check for a different building.
 *
 * Retired items are left out. They are history, not load.
 */
export const checkAddition = async ({
  userUuid,
  spaceUuid,
  lines,
  variables,
}: {
  userUuid: string;
  spaceUuid: string;
  lines: { productUuid: string; quantity: number }[];
  variables?: Parameters<typeof gateSelection>[0]["variables"];
}): Promise<AdditionCheck> => {
  const [space] = await db
    .select({ uuid: Spaces.uuid })
    .from(Spaces)
    .where(and(eq(Spaces.uuid, spaceUuid), eq(Spaces.userUuid, userUuid)));
  if (!space) {
    throw new ValidationError("That space could not be found.");
  }

  const installed = await db
    .select({
      productUuid: SpaceItems.productUuid,
      name: SpaceItems.name,
      quantity: SpaceItems.quantity,
    })
    .from(SpaceItems)
    .where(eq(SpaceItems.spaceUuid, spaceUuid));

  // A row whose product left the catalogue cannot be judged — there are no
  // specification values left to read. Dropped from the selection rather than
  // guessed at, and the count of what was dropped belongs in the caller's hands
  // via `existing`, which only lists what could be used.
  const existing = installed.flatMap((row) =>
    row.productUuid === null || row.quantity < 1
      ? []
      : [{ productUuid: row.productUuid, name: row.name, quantity: row.quantity }],
  );

  // Merged by product, because the engine counts units and the register may hold
  // the same model across several rows — three detectors recorded individually are
  // three detectors of load, not three separate designs.
  const totals = new Map<string, number>();
  for (const row of [...existing, ...lines.map((line) => ({ ...line }))]) {
    totals.set(
      row.productUuid,
      (totals.get(row.productUuid) ?? 0) + row.quantity,
    );
  }

  const gate = await gateSelection({
    selection: [...totals].map(([productUuid, quantity]) => ({
      productUuid,
      quantity,
    })),
    variables,
  });

  return { gate, existing };
};

/**
 * Judge the customer's current basket against this site.
 *
 * The basket is the picker. Building a second product chooser onto the site page
 * would be a whole shopping surface nobody asked for, when the one the customer
 * has been using is already full of exactly the things they are thinking of
 * adding — and this way the answer they get here is the same engine that will
 * judge them at checkout, on the same lines.
 *
 * Returns null when the cart is empty, which is not a failure: there is simply no
 * question to answer, and an "it all works" verdict over nothing would be the
 * emptiest kind of reassurance.
 */
export const checkCartAgainstSpace = async ({
  userUuid,
  spaceUuid,
  variables,
}: {
  userUuid: string;
  spaceUuid: string;
  variables?: Parameters<typeof gateSelection>[0]["variables"];
}): Promise<(AdditionCheck & { adding: { name: string; quantity: number }[] }) | null> => {
  const cart = (await getCart(userUuid)).filter(
    (item) => item.kind === "product",
  );
  if (cart.length === 0) {
    return null;
  }

  const check = await checkAddition({
    userUuid,
    spaceUuid,
    lines: cart.map((item) => ({
      productUuid: item.productUuid,
      quantity: item.quantity,
    })),
    variables,
  });

  return {
    ...check,
    adding: cart.map((item) => ({ name: item.name, quantity: item.quantity })),
  };
};

// ---------------------------------------------------------------------------
// Callouts.
// ---------------------------------------------------------------------------

export type RaiseCalloutInput = {
  userUuid: string;
  spaceUuid: string;
  itemUuid?: string | null;
  kind: ServiceRequestKind;
  detail: string;
  // What the schedule said at the moment this was raised, snapshotted onto the
  // row. Passed in rather than recomputed here so the sentence the customer was
  // looking at is the sentence that gets stored.
  dueReason?: string | null;
};

/** Ask for somebody to come out. */
export const raiseCallout = async (
  input: RaiseCalloutInput,
): Promise<SelectServiceRequests> => {
  const detail = input.detail.trim();
  if (detail === "") {
    throw new ValidationError(
      "Say what is wrong — an engineer with no description arrives with the wrong parts.",
    );
  }

  const [space] = await db
    .select({ uuid: Spaces.uuid, name: Spaces.name })
    .from(Spaces)
    .where(and(eq(Spaces.uuid, input.spaceUuid), eq(Spaces.userUuid, input.userUuid)));
  if (!space) {
    throw new ValidationError("That space could not be found.");
  }

  // An item from ANOTHER site would otherwise attach cleanly — the foreign key
  // only says it is a real item, not that it is one of theirs.
  if (input.itemUuid) {
    const [item] = await db
      .select({ uuid: SpaceItems.uuid })
      .from(SpaceItems)
      .where(
        and(
          eq(SpaceItems.uuid, input.itemUuid),
          eq(SpaceItems.spaceUuid, input.spaceUuid),
        ),
      );
    if (!item) {
      throw new ValidationError("That item is not at this site.");
    }
  }

  const uuid = generateUuid();
  await db.insert(ServiceRequests).values({
    uuid,
    reference: `SVC-${uuid.slice(0, 8).toUpperCase()}`,
    spaceUuid: input.spaceUuid,
    itemUuid: input.itemUuid ?? null,
    raisedByUserUuid: input.userUuid,
    kind: input.kind,
    detail,
    dueReason: input.dueReason?.slice(0, 500) ?? null,
  });

  const [request] = await db
    .select()
    .from(ServiceRequests)
    .where(eq(ServiceRequests.uuid, uuid));
  if (!request) {
    throw new Error("Failed to raise that request");
  }

  await notify({
    audience: "admin",
    kind: "service_request",
    title: `${request.reference} — a visit has been asked for at ${space.name}`,
    body: detail.slice(0, 200),
    href: "/service",
  });

  return request;
};

export type ServiceRequestRow = SelectServiceRequests & {
  spaceName: SelectSpaces["name"];
  ownerName: SelectUsers["fullName"] | null;
  // Null when the request names no item, and also when the item it named has since
  // been retired and its row removed — the request survives either way.
  itemName: SelectSpaceItems["name"] | null;
};

/** The callout queue, oldest first — a visit nobody booked is the one to book. */
export const listServiceRequests = async (): Promise<ServiceRequestRow[]> =>
  db
    .select({
      ...getTableColumns(ServiceRequests),
      spaceName: Spaces.name,
      ownerName: Users.fullName,
      itemName: SpaceItems.name,
    })
    .from(ServiceRequests)
    .innerJoin(Spaces, eq(ServiceRequests.spaceUuid, Spaces.uuid))
    .leftJoin(Users, eq(ServiceRequests.raisedByUserUuid, Users.uuid))
    .leftJoin(SpaceItems, eq(ServiceRequests.itemUuid, SpaceItems.uuid))
    .orderBy(desc(ServiceRequests.createdAt));

/** This customer's own requests for one site. */
export const listSpaceRequests = async (
  userUuid: string,
  spaceUuid: string,
): Promise<SelectServiceRequests[]> =>
  db
    .select({ ...getTableColumns(ServiceRequests) })
    .from(ServiceRequests)
    .innerJoin(Spaces, eq(ServiceRequests.spaceUuid, Spaces.uuid))
    .where(
      and(eq(ServiceRequests.spaceUuid, spaceUuid), eq(Spaces.userUuid, userUuid)),
    )
    .orderBy(desc(ServiceRequests.createdAt));

/** Book a date, and tell the customer. */
export const scheduleCallout = async ({
  requestUuid,
  scheduledFor,
  scheduledBy,
}: {
  requestUuid: string;
  scheduledFor: string;
  scheduledBy: string;
}): Promise<SelectServiceRequests> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledFor)) {
    throw new ValidationError("Pick a date for the visit.");
  }

  // Atomic guard rather than read-then-write: two operators booking the same
  // callout would otherwise both succeed and the second would silently overwrite
  // the first one's date.
  const result = await db
    .update(ServiceRequests)
    .set({ status: "scheduled", scheduledFor, scheduledBy })
    .where(
      and(
        eq(ServiceRequests.uuid, requestUuid),
        eq(ServiceRequests.status, "open"),
      ),
    );

  const affected = (result as unknown as { affectedRows?: number }[])[0]
    ?.affectedRows;
  if (affected === 0) {
    throw new ConflictError("That request has already been booked or closed.");
  }

  const [request] = await db
    .select({
      ...getTableColumns(ServiceRequests),
      clerkUserId: Users.clerkUserId,
      spaceName: Spaces.name,
    })
    .from(ServiceRequests)
    .innerJoin(Spaces, eq(ServiceRequests.spaceUuid, Spaces.uuid))
    .leftJoin(Users, eq(ServiceRequests.raisedByUserUuid, Users.uuid))
    .where(eq(ServiceRequests.uuid, requestUuid));
  if (!request) {
    throw new Error("Failed to book that visit");
  }

  await notify({
    audience: "client",
    kind: "service_request",
    recipientClerkUserId: request.clerkUserId,
    title: `Your visit to ${request.spaceName} is booked for ${scheduledFor}`,
    body: `Reference ${request.reference}. We will call to agree a time.`,
    href: "/spaces",
  });

  const { clerkUserId: _clerk, spaceName: _space, ...row } = request;
  return row;
};

/** Record what was done. */
export const recordVisit = async ({
  requestUuid,
  outcome,
  close,
}: {
  requestUuid: string;
  outcome: string;
  // Most visits end the matter. One that does not — a part had to be ordered —
  // stays open, which is why this is a choice rather than automatic.
  close: boolean;
}): Promise<void> => {
  if (outcome.trim() === "") {
    throw new ValidationError("Record what was done on the visit.");
  }

  await db
    .update(ServiceRequests)
    .set({
      status: close ? "closed" : "attended",
      outcome: outcome.trim(),
      attendedAt: new Date(),
      closedAt: close ? new Date() : null,
    })
    .where(eq(ServiceRequests.uuid, requestUuid));
};
