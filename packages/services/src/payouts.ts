import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { fromMinorUnits, toMinorUnits } from "utils";
import { db } from "../../../db";
import {
  PartnerEarnings,
  PartnerPayouts,
  SelectPartnerEarnings,
  SelectPartnerPayouts,
} from "../../../db/schema/payouts";
import { ConflictError, ValidationError } from "./errors";
import type { DbExecutor } from "./partners";

export type { SelectPartnerEarnings, SelectPartnerPayouts };

// Totals a partner sees on their portal — owed (accrued), invoiced, and paid.
// Each is a plain aggregate, so it isn't derived from a single column.
export type PartnerEarningsSummary = {
  accrued: number;
  invoiced: number;
  paid: number;
};

/**
 * Accrue a PAYABLE — money SOT owes the partner for a verified order's service.
 * Runs inside the caller's handover transaction. This is a ledger entry of an
 * amount owed, never custodied funds.
 */
export const accruePartnerEarning = async (
  executor: DbExecutor,
  input: {
    partnerClerkUserId: string;
    orderUuid: string;
    amount: string;
    currency: string | null;
  },
): Promise<string> => {
  const uuid = randomUUID();
  await executor.insert(PartnerEarnings).values({
    uuid,
    partnerClerkUserId: input.partnerClerkUserId,
    orderUuid: input.orderUuid,
    amount: input.amount,
    currency: input.currency ?? "SAR",
  });
  return uuid;
};

/**
 * Immediately clear an integrated partner's freshly accrued earnings with an
 * auto-generated, already-paid payout — the "paid instantly at handover" path.
 * Runs inside the handover transaction so accrual and payout are atomic.
 */
export const settleIntegratedPartner = async (
  executor: DbExecutor,
  partnerClerkUserId: string,
): Promise<void> => {
  const accrued = await executor
    .select()
    .from(PartnerEarnings)
    .where(
      and(
        eq(PartnerEarnings.partnerClerkUserId, partnerClerkUserId),
        eq(PartnerEarnings.status, "accrued"),
      ),
    );
  if (accrued.length === 0) {
    return;
  }

  // Integer minor units. This is money owed to a partner, accumulated over an
  // arbitrary number of earnings rows — adding decimal strings as floats drifts
  // as the row count grows, and toFixed at the end cannot recover a cent that
  // was lost mid-sum.
  const totalMinor = accrued.reduce(
    (sum, row) => sum + toMinorUnits(row.amount),
    0,
  );
  const payoutUuid = randomUUID();
  const now = new Date();

  await executor.insert(PartnerPayouts).values({
    uuid: payoutUuid,
    reference: `PAY-${payoutUuid.slice(0, 8).toUpperCase()}`,
    partnerClerkUserId,
    amount: fromMinorUnits(totalMinor).toFixed(2),
    currency: accrued[0]?.currency ?? "SAR",
    status: "paid",
    auto: true,
    paidAt: now,
  });

  await executor
    .update(PartnerEarnings)
    .set({ status: "paid", payoutUuid })
    .where(
      inArray(
        PartnerEarnings.uuid,
        accrued.map((row) => row.uuid),
      ),
    );
};

/** The accrued / invoiced / paid totals for a partner. */
export const getPartnerEarningsSummary = async (
  partnerClerkUserId: string,
): Promise<PartnerEarningsSummary> => {
  const rows = await db
    .select({
      status: PartnerEarnings.status,
      total: sql<number>`sum(${PartnerEarnings.amount})`.mapWith(Number),
    })
    .from(PartnerEarnings)
    .where(eq(PartnerEarnings.partnerClerkUserId, partnerClerkUserId))
    .groupBy(PartnerEarnings.status);

  const byStatus = new Map(rows.map((row) => [row.status, row.total]));
  return {
    accrued: byStatus.get("accrued") ?? 0,
    invoiced: byStatus.get("invoiced") ?? 0,
    paid: byStatus.get("paid") ?? 0,
  };
};

/** Every earning line for a partner, newest first. */
export const listPartnerEarnings = async (
  partnerClerkUserId: string,
): Promise<SelectPartnerEarnings[]> =>
  db
    .select()
    .from(PartnerEarnings)
    .where(eq(PartnerEarnings.partnerClerkUserId, partnerClerkUserId))
    .orderBy(desc(PartnerEarnings.accruedAt));

/** Requested payouts awaiting settlement by a SOT operator, newest first. */
export const listPayoutsForReview = async (): Promise<SelectPartnerPayouts[]> =>
  db
    .select()
    .from(PartnerPayouts)
    .where(eq(PartnerPayouts.status, "requested"))
    .orderBy(desc(PartnerPayouts.requestedAt));

/** Every payout for a partner, newest first. */
export const listPartnerPayouts = async (
  partnerClerkUserId: string,
): Promise<SelectPartnerPayouts[]> =>
  db
    .select()
    .from(PartnerPayouts)
    .where(eq(PartnerPayouts.partnerClerkUserId, partnerClerkUserId))
    .orderBy(desc(PartnerPayouts.requestedAt));

/**
 * A non-integrated partner cashes out: raise one payout covering all their
 * accrued earnings (with the ZATCA invoice they uploaded) and mark those
 * earnings invoiced. SOT settles it later via markPayoutPaid.
 */
export const requestPayout = async ({
  partnerClerkUserId,
  invoiceDocument,
}: {
  partnerClerkUserId: string;
  invoiceDocument?: string;
}): Promise<SelectPartnerPayouts> => {
  const payoutUuid = randomUUID();

  await db.transaction(async (tx) => {
    const accrued = await tx
      .select()
      .from(PartnerEarnings)
      .where(
        and(
          eq(PartnerEarnings.partnerClerkUserId, partnerClerkUserId),
          eq(PartnerEarnings.status, "accrued"),
        ),
      );
    if (accrued.length === 0) {
      throw new ValidationError("You have no earnings to cash out");
    }

    // Integer minor units. This is money owed to a partner, accumulated over an
    // arbitrary number of earnings rows — adding decimal strings as floats drifts
    // as the row count grows, and toFixed at the end cannot recover a cent that
    // was lost mid-sum.
    const totalMinor = accrued.reduce(
      (sum, row) => sum + toMinorUnits(row.amount),
      0,
    );
    await tx.insert(PartnerPayouts).values({
      uuid: payoutUuid,
      reference: `PAY-${payoutUuid.slice(0, 8).toUpperCase()}`,
      partnerClerkUserId,
      amount: fromMinorUnits(totalMinor).toFixed(2),
      currency: accrued[0]?.currency ?? "SAR",
      status: "requested",
      invoiceDocument: invoiceDocument ?? null,
    });

    await tx
      .update(PartnerEarnings)
      .set({ status: "invoiced", payoutUuid })
      .where(
        inArray(
          PartnerEarnings.uuid,
          accrued.map((row) => row.uuid),
        ),
      );
  });

  const [payout] = await db
    .select()
    .from(PartnerPayouts)
    .where(eq(PartnerPayouts.uuid, payoutUuid));
  if (!payout) {
    throw new Error("Failed to create payout");
  }
  return payout;
};

/** SOT settles a requested payout — transfers the money and clears the ledger. */
export const markPayoutPaid = async (
  payoutUuid: string,
): Promise<SelectPartnerPayouts> => {
  const [payout] = await db
    .select()
    .from(PartnerPayouts)
    .where(eq(PartnerPayouts.uuid, payoutUuid));
  if (!payout) {
    throw new ValidationError("Payout not found");
  }
  if (payout.status !== "requested") {
    throw new ConflictError("This payout has already been paid");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(PartnerPayouts)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(PartnerPayouts.uuid, payoutUuid));

    await tx
      .update(PartnerEarnings)
      .set({ status: "paid" })
      .where(eq(PartnerEarnings.payoutUuid, payoutUuid));
  });

  const [updated] = await db
    .select()
    .from(PartnerPayouts)
    .where(eq(PartnerPayouts.uuid, payoutUuid));
  if (!updated) {
    throw new Error("Failed to settle payout");
  }
  return updated;
};
