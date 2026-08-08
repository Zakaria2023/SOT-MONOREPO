import { and, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { fromMinorUnits, toMinorUnits } from "utils";
import { db } from "../../../db";
import { Boqs, type SelectBoqs } from "../../../db/schema/boqs";
import { Orders, type SelectOrders } from "../../../db/schema/orders";
import {
  PartnerEarnings,
  PartnerPayouts,
  SelectPartnerEarnings,
  SelectPartnerPayouts,
} from "../../../db/schema/payouts";
import { ConflictError, ValidationError } from "./errors";
import { notify } from "./notifications";
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

/**
 * Every earning line for a partner, newest first, each naming the job it came
 * from.
 *
 * The join is the point. This returned bare earnings rows carrying an
 * `orderUuid`, so the only thing a partner could be shown was a total and a
 * 36-character identifier — and a figure somebody cannot break down into the jobs
 * that produced it is a figure they cannot check. "You are owed 14,500" is an
 * assertion; "you are owed 14,500, and here are the six handovers" is a
 * statement they can disagree with.
 */
export type PartnerEarningLine = SelectPartnerEarnings & {
  orderReference: SelectOrders["reference"] | null;
  boqReference: SelectBoqs["reference"] | null;
};

export const listPartnerEarnings = async (
  partnerClerkUserId: string,
): Promise<PartnerEarningLine[]> =>
  db
    .select({
      ...getTableColumns(PartnerEarnings),
      orderReference: Orders.reference,
      // The BOQ reference is what a partner recognises — it is the number on the
      // job they went to site for. The order reference is ours.
      boqReference: Boqs.reference,
    })
    .from(PartnerEarnings)
    .leftJoin(Orders, eq(PartnerEarnings.orderUuid, Orders.uuid))
    .leftJoin(Boqs, eq(Orders.boqUuid, Boqs.uuid))
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
 * accrued earnings, with the invoice they uploaded, and mark those earnings
 * invoiced. SOT settles it later via markPayoutPaid.
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

  // Addressed to the desk rather than to a person, like every other staff notice:
  // whoever is on finance today deals with it. Without this a partner's cash-out
  // sat in `requested` until somebody thought to open the payouts screen, and the
  // partner had no way to tell being queued from being ignored.
  await notify({
    audience: "admin",
    kind: "payment_recorded",
    title: `${payout.reference} — a partner has cashed out`,
    body: `${payout.amount} ${payout.currency ?? "SAR"} awaiting transfer.`,
    href: "/payouts",
  });

  return payout;
};

/** SOT settles a requested payout — transfers the money and clears the ledger. */
export const markPayoutPaid = async (
  payoutUuid: string,
  // How the transfer can be found again. Required rather than optional: a
  // payout marked paid that cannot be matched to a bank statement is an
  // assertion, not a record.
  transfer: { reference: string; by: string },
): Promise<SelectPartnerPayouts> => {
  if (transfer.reference.trim() === "") {
    throw new ValidationError("A transfer needs a reference.");
  }
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
      .set({
        status: "paid",
        paidAt: new Date(),
        paidReference: transfer.reference.trim(),
        paidBy: transfer.by,
      })
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

  // Addressed to the partner, and carrying the transfer reference. This is the one
  // notification in the system somebody will go looking for, and the reference is
  // what lets them match it against their bank rather than take our word for it.
  await notify({
    audience: "client",
    kind: "payment_recorded",
    recipientClerkUserId: updated.partnerClerkUserId,
    title: `You have been paid — ${updated.reference}`,
    body: `${updated.amount} ${updated.currency ?? "SAR"} transferred, reference ${transfer.reference.trim()}.`,
    href: "/earnings",
  });

  return updated;
};
