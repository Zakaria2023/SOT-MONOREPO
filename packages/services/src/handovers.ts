import { and, asc, desc, eq, getTableColumns, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
import { BoqItems, Boqs, SelectBoqs } from "../../../db/schema/boqs";
import {
  HandoverAssets,
  HandoverCredentials,
  HandoverPacks,
  SelectHandoverAssets,
  SelectHandoverCredentials,
  SelectHandoverPacks,
} from "../../../db/schema/handovers";
import { Offers } from "../../../db/schema/offers";
import { Orders } from "../../../db/schema/orders";
import { PartnerRequests } from "../../../db/schema/partner-requests";
import { HandoverCredentialType } from "../../../db/enum";
import { ConflictError, ForbiddenError, ValidationError } from "./errors";
import { accruePartnerEarning, settleIntegratedPartner } from "./payouts";

export type {
  SelectHandoverAssets,
  SelectHandoverCredentials,
  SelectHandoverPacks,
};

export type HandoverDetail = {
  pack: SelectHandoverPacks;
  assets: SelectHandoverAssets[];
  credentials: SelectHandoverCredentials[];
};

export type HandoverReviewItem = SelectHandoverPacks & {
  boqReference: SelectBoqs["reference"] | null;
};

export type UpdateHandoverAssetInput = {
  location?: SelectHandoverAssets["location"];
  localIp?: SelectHandoverAssets["localIp"];
  port?: SelectHandoverAssets["port"];
  macAddress?: SelectHandoverAssets["macAddress"];
  serialNumber?: SelectHandoverAssets["serialNumber"];
  photo?: SelectHandoverAssets["photo"];
  notes?: SelectHandoverAssets["notes"];
};

export type UpsertHandoverCredentialInput = {
  type: HandoverCredentialType;
  label: string;
  target?: SelectHandoverCredentials["target"];
  username?: SelectHandoverCredentials["username"];
  // Plaintext in transit only — the caller is responsible for encrypting the
  // secret at rest before it reaches storage.
  secret?: SelectHandoverCredentials["secret"];
  notes?: SelectHandoverCredentials["notes"];
};

/**
 * Open the handover pack for an installed BOQ and seed its as-built asset rows
 * from the BOQ's product lines — one row per physical device (a line of qty 3
 * becomes 3 asset records to be located, IP'd and photographed individually).
 * Idempotent: returns the existing pack if one is already open.
 */
export const createHandoverPack = async ({
  boqUuid,
  partnerClerkUserId,
}: {
  boqUuid: string;
  partnerClerkUserId: string;
}): Promise<SelectHandoverPacks> => {
  const [boq] = await db.select().from(Boqs).where(eq(Boqs.uuid, boqUuid));
  if (!boq) {
    throw new ValidationError("BOQ not found");
  }
  if (boq.status !== "installed") {
    throw new ConflictError(
      "A handover pack can only be started once the BOQ is installed",
    );
  }

  const [existing] = await db
    .select()
    .from(HandoverPacks)
    .where(eq(HandoverPacks.boqUuid, boqUuid));
  if (existing) {
    return existing;
  }

  const productLines = await db
    .select()
    .from(BoqItems)
    .where(and(eq(BoqItems.boqUuid, boqUuid), eq(BoqItems.lineType, "product")));

  const packUuid = randomUUID();

  await db.transaction(async (tx) => {
    await tx
      .insert(HandoverPacks)
      .values({ uuid: packUuid, boqUuid, partnerClerkUserId });

    const assetRows = productLines.flatMap((line) =>
      Array.from({ length: Math.max(1, line.quantity) }, () => ({
        uuid: randomUUID(),
        packUuid,
        boqItemUuid: line.uuid,
        name: line.name,
      })),
    );
    if (assetRows.length > 0) {
      await tx.insert(HandoverAssets).values(assetRows);
    }
  });

  const [pack] = await db
    .select()
    .from(HandoverPacks)
    .where(eq(HandoverPacks.uuid, packUuid));
  if (!pack) {
    throw new Error("Failed to open handover pack");
  }
  return pack;
};

// Load the whole pack (assets + credentials). Internal — callers use the
// ownership-scoped variants below.
const getHandover = async (boqUuid: string): Promise<HandoverDetail | null> => {
  const [pack] = await db
    .select()
    .from(HandoverPacks)
    .where(eq(HandoverPacks.boqUuid, boqUuid));
  if (!pack) {
    return null;
  }

  const [assets, credentials] = await Promise.all([
    db
      .select()
      .from(HandoverAssets)
      .where(eq(HandoverAssets.packUuid, pack.uuid))
      .orderBy(asc(HandoverAssets.createdAt)),
    db
      .select()
      .from(HandoverCredentials)
      .where(eq(HandoverCredentials.packUuid, pack.uuid))
      .orderBy(asc(HandoverCredentials.createdAt)),
  ]);

  return { pack, assets, credentials };
};

/** The handover pack for a BOQ the customer owns — the permanent record. */
export const getCustomerHandover = async (
  userUuid: string,
  boqUuid: string,
): Promise<HandoverDetail | null> => {
  const [boq] = await db
    .select({ userUuid: Boqs.userUuid })
    .from(Boqs)
    .where(eq(Boqs.uuid, boqUuid));
  if (!boq || boq.userUuid !== userUuid) {
    return null;
  }
  return getHandover(boqUuid);
};

/**
 * Packs that need a SOT operator's attention — awaiting the remote check,
 * awaiting release, or disputed — newest activity first (verifier queue).
 */
export const listHandoversForReview = async (): Promise<
  HandoverReviewItem[]
> =>
  db
    .select({ ...getTableColumns(HandoverPacks), boqReference: Boqs.reference })
    .from(HandoverPacks)
    .leftJoin(Boqs, eq(HandoverPacks.boqUuid, Boqs.uuid))
    .where(
      inArray(HandoverPacks.status, [
        "submitted",
        "customer_confirmed",
        "verified",
        "disputed",
      ]),
    )
    .orderBy(desc(HandoverPacks.updatedAt));

/** The full pack for a SOT operator to review (not ownership-scoped). */
export const getHandoverForReview = async (
  boqUuid: string,
): Promise<HandoverDetail | null> => getHandover(boqUuid);

/** The handover pack for a BOQ this partner is assembling. */
export const getPartnerHandover = async (
  partnerClerkUserId: string,
  boqUuid: string,
): Promise<HandoverDetail | null> => {
  const detail = await getHandover(boqUuid);
  if (!detail || detail.pack.partnerClerkUserId !== partnerClerkUserId) {
    return null;
  }
  return detail;
};

// Load a pack that is still editable by this partner (draft), else throw.
const loadEditablePack = async (
  partnerClerkUserId: string,
  packUuid: string,
): Promise<SelectHandoverPacks> => {
  const [pack] = await db
    .select()
    .from(HandoverPacks)
    .where(eq(HandoverPacks.uuid, packUuid));
  if (!pack) {
    throw new ValidationError("Handover pack not found");
  }
  if (pack.partnerClerkUserId !== partnerClerkUserId) {
    throw new ForbiddenError("This handover pack isn't yours");
  }
  if (pack.status !== "draft") {
    throw new ConflictError("This handover pack can no longer be edited");
  }
  return pack;
};

/** Fill in an as-built asset's install detail (partner, while pack is draft). */
export const updateHandoverAsset = async ({
  partnerClerkUserId,
  assetUuid,
  values,
}: {
  partnerClerkUserId: string;
  assetUuid: string;
  values: UpdateHandoverAssetInput;
}): Promise<void> => {
  const [asset] = await db
    .select({ packUuid: HandoverAssets.packUuid })
    .from(HandoverAssets)
    .where(eq(HandoverAssets.uuid, assetUuid));
  if (!asset) {
    throw new ValidationError("Asset not found");
  }
  await loadEditablePack(partnerClerkUserId, asset.packUuid);

  await db
    .update(HandoverAssets)
    .set(values)
    .where(eq(HandoverAssets.uuid, assetUuid));
};

/** Add a credential to a draft pack (offline / cloud-admin / device access). */
export const addHandoverCredential = async ({
  partnerClerkUserId,
  packUuid,
  values,
}: {
  partnerClerkUserId: string;
  packUuid: string;
  values: UpsertHandoverCredentialInput;
}): Promise<SelectHandoverCredentials> => {
  await loadEditablePack(partnerClerkUserId, packUuid);

  const uuid = randomUUID();
  await db.insert(HandoverCredentials).values({
    uuid,
    packUuid,
    type: values.type,
    label: values.label,
    target: values.target ?? null,
    username: values.username ?? null,
    secret: values.secret ?? null,
    notes: values.notes ?? null,
  });

  const [credential] = await db
    .select()
    .from(HandoverCredentials)
    .where(eq(HandoverCredentials.uuid, uuid));
  if (!credential) {
    throw new Error("Failed to add credential");
  }
  return credential;
};

/**
 * Partner submits the completed pack for the customer to confirm. Requires at
 * least one credential — a handover with no way to reach the system is not a
 * handover.
 */
export const submitHandoverPack = async ({
  partnerClerkUserId,
  packUuid,
  trainingNotes,
}: {
  partnerClerkUserId: string;
  packUuid: string;
  trainingNotes?: string;
}): Promise<SelectHandoverPacks> => {
  await loadEditablePack(partnerClerkUserId, packUuid);

  const [credential] = await db
    .select({ id: HandoverCredentials.id })
    .from(HandoverCredentials)
    .where(eq(HandoverCredentials.packUuid, packUuid))
    .limit(1);
  if (!credential) {
    throw new ValidationError(
      "Add at least one access credential before submitting",
    );
  }

  await db
    .update(HandoverPacks)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      trainingNotes: trainingNotes?.trim() ? trainingNotes.trim() : null,
    })
    .where(eq(HandoverPacks.uuid, packUuid));

  const [pack] = await db
    .select()
    .from(HandoverPacks)
    .where(eq(HandoverPacks.uuid, packUuid));
  if (!pack) {
    throw new Error("Failed to submit handover pack");
  }
  return pack;
};

/**
 * The customer confirms their access works — the primary verification, since
 * the whole point is that THEY hold control. Scoped to the BOQ owner.
 */
export const confirmHandoverByCustomer = async ({
  userUuid,
  boqUuid,
}: {
  userUuid: string;
  boqUuid: string;
}): Promise<SelectHandoverPacks> => {
  const detail = await getCustomerHandover(userUuid, boqUuid);
  if (!detail) {
    throw new ValidationError("Handover not found");
  }
  if (detail.pack.status !== "submitted") {
    throw new ConflictError("This handover isn't awaiting your confirmation");
  }

  await db
    .update(HandoverPacks)
    .set({ status: "customer_confirmed", customerConfirmedAt: new Date() })
    .where(eq(HandoverPacks.uuid, detail.pack.uuid));

  const [pack] = await db
    .select()
    .from(HandoverPacks)
    .where(eq(HandoverPacks.uuid, detail.pack.uuid));
  if (!pack) {
    throw new Error("Failed to confirm handover");
  }
  return pack;
};

/**
 * SOT's remote completeness check (Phase 1: an operator). Moves the pack to
 * verified and the BOQ from `installed` to `verified`. Does not release money
 * — that happens at completeHandover.
 */
export const verifyHandover = async ({
  boqUuid,
  sotClerkUserId,
  sotName,
}: {
  boqUuid: string;
  sotClerkUserId?: string;
  sotName?: string;
}): Promise<SelectHandoverPacks> => {
  const [pack] = await db
    .select()
    .from(HandoverPacks)
    .where(eq(HandoverPacks.boqUuid, boqUuid));
  if (!pack) {
    throw new ValidationError("Handover not found");
  }
  if (pack.status !== "customer_confirmed") {
    throw new ConflictError(
      "The customer must confirm their access before verification",
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(HandoverPacks)
      .set({
        status: "verified",
        sotVerifiedByClerkUserId: sotClerkUserId ?? null,
        sotVerifiedByName: sotName ?? null,
        sotVerifiedAt: new Date(),
      })
      .where(eq(HandoverPacks.uuid, pack.uuid));

    await tx
      .update(Boqs)
      .set({ status: "verified" })
      .where(and(eq(Boqs.uuid, boqUuid), eq(Boqs.status, "installed")));
  });

  const [updated] = await db
    .select()
    .from(HandoverPacks)
    .where(eq(HandoverPacks.uuid, pack.uuid));
  if (!updated) {
    throw new Error("Failed to verify handover");
  }
  return updated;
};

/**
 * Complete the handover — the escrow release. The BOQ moves `verified →
 * handed_over`, and the partner's service earning is accrued as a PAYABLE.
 * Integrated partners are settled immediately (auto invoice + pay); others see
 * the amount as owed and cash out later. Requires the order to be paid, so SOT
 * only releases money it has actually received.
 */
export const completeHandover = async ({
  boqUuid,
}: {
  boqUuid: string;
}): Promise<SelectHandoverPacks> => {
  const [pack] = await db
    .select()
    .from(HandoverPacks)
    .where(eq(HandoverPacks.boqUuid, boqUuid));
  if (!pack) {
    throw new ValidationError("Handover not found");
  }
  if (pack.status !== "verified") {
    throw new ConflictError("This handover hasn't been verified yet");
  }

  const [order] = await db
    .select({
      uuid: Orders.uuid,
      status: Orders.status,
      serviceTotal: Orders.serviceTotal,
      currency: Orders.currency,
      partnerClerkUserId: Offers.partnerClerkUserId,
    })
    .from(Orders)
    .innerJoin(Offers, eq(Orders.offerUuid, Offers.uuid))
    .where(eq(Orders.boqUuid, boqUuid));
  if (!order) {
    throw new ValidationError("No order backs this handover");
  }
  if (order.status !== "paid") {
    throw new ConflictError("The order must be paid before handover completes");
  }

  const [partnerRequest] = await db
    .select({ isIntegrated: PartnerRequests.isIntegrated })
    .from(PartnerRequests)
    .where(eq(PartnerRequests.approvedClerkUserId, order.partnerClerkUserId));
  const isIntegrated = partnerRequest?.isIntegrated ?? false;

  await db.transaction(async (tx) => {
    await tx
      .update(Boqs)
      .set({ status: "handed_over" })
      .where(and(eq(Boqs.uuid, boqUuid), eq(Boqs.status, "verified")));

    await accruePartnerEarning(tx, {
      partnerClerkUserId: order.partnerClerkUserId,
      orderUuid: order.uuid,
      amount: order.serviceTotal,
      currency: order.currency,
    });

    if (isIntegrated) {
      await settleIntegratedPartner(tx, order.partnerClerkUserId);
    }
  });

  const [updated] = await db
    .select()
    .from(HandoverPacks)
    .where(eq(HandoverPacks.uuid, pack.uuid));
  if (!updated) {
    throw new Error("Failed to complete handover");
  }
  return updated;
};

/** Flag a handover as disputed with a reason (routes to physical inspection). */
export const disputeHandover = async ({
  boqUuid,
  reason,
}: {
  boqUuid: string;
  reason: string;
}): Promise<SelectHandoverPacks> => {
  const [pack] = await db
    .select()
    .from(HandoverPacks)
    .where(eq(HandoverPacks.boqUuid, boqUuid));
  if (!pack) {
    throw new ValidationError("Handover not found");
  }
  if (pack.status === "verified") {
    throw new ConflictError("A verified handover can't be disputed");
  }

  await db
    .update(HandoverPacks)
    .set({ status: "disputed", disputeReason: reason.trim() })
    .where(eq(HandoverPacks.uuid, pack.uuid));

  const [updated] = await db
    .select()
    .from(HandoverPacks)
    .where(eq(HandoverPacks.uuid, pack.uuid));
  if (!updated) {
    throw new Error("Failed to dispute handover");
  }
  return updated;
};
