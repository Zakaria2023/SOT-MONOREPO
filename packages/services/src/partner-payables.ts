import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../db";
import {
  PartnerEarnings,
  PartnerPayouts,
  type SelectPartnerPayouts,
} from "../../../db/schema/payouts";
import { PartnerRequests } from "../../../db/schema/partner-requests";

// ---------------------------------------------------------------------------
// A10 — WHAT WE OWE PARTNERS.
//
// A finance clerk works here. They approve invoices and record transfers, and
// they must not be able to see platform margin — that is A11, and the split is
// the whole point of this file rather than a layout preference.
//
// It is enforced by the TYPES, not by leaving a column off a screen. Nothing
// this module returns carries revenue, cost or margin, so a payables surface
// cannot render a number it was never given, and a future "just add the total
// here" cannot quietly reintroduce it. The same reasoning that keeps the net
// unit price off PricedLine.
//
// Everything here is one side of a ledger: amounts owed, amounts invoiced,
// amounts transferred. What the customer paid for the job is not on it.
// ---------------------------------------------------------------------------

export type PartnerPayable = {
  partnerClerkUserId: string;
  // Denormalised for the screen. A payables list keyed by a Clerk id is
  // unusable by the person who has to pay it.
  partnerName: string | null;
  companyName: string | null;
  currency: string;
  // Earned on verified handovers and not yet covered by a payout.
  accrued: number;
  // Covered by a payout the partner has invoiced, awaiting transfer.
  invoiced: number;
  // Transferred.
  paid: number;
  // What is actually outstanding — accrued plus invoiced. The number the clerk
  // is here for.
  outstanding: number;
};

const toNumber = (value: string | number | null): number => Number(value ?? 0);

/**
 * Every partner we owe money to, most owed first.
 *
 * One grouped query rather than a query per partner: this is a finance screen
 * over a shared database with a hard connection ceiling, and the partner list
 * only grows.
 */
export const listPartnerPayables = async (): Promise<PartnerPayable[]> => {
  const rows = await db
    .select({
      partnerClerkUserId: PartnerEarnings.partnerClerkUserId,
      currency: sql<string>`MIN(${PartnerEarnings.currency})`,
      accrued: sql<string>`SUM(CASE WHEN ${PartnerEarnings.status} = 'accrued' THEN ${PartnerEarnings.amount} ELSE 0 END)`,
      invoiced: sql<string>`SUM(CASE WHEN ${PartnerEarnings.status} = 'invoiced' THEN ${PartnerEarnings.amount} ELSE 0 END)`,
      paid: sql<string>`SUM(CASE WHEN ${PartnerEarnings.status} = 'paid' THEN ${PartnerEarnings.amount} ELSE 0 END)`,
      partnerName: sql<string | null>`MIN(${PartnerRequests.fullName})`,
      companyName: sql<string | null>`MIN(${PartnerRequests.companyName})`,
    })
    .from(PartnerEarnings)
    .leftJoin(
      PartnerRequests,
      eq(PartnerRequests.approvedClerkUserId, PartnerEarnings.partnerClerkUserId),
    )
    .groupBy(PartnerEarnings.partnerClerkUserId);

  return rows
    .map((row) => {
      const accrued = toNumber(row.accrued);
      const invoiced = toNumber(row.invoiced);
      return {
        partnerClerkUserId: row.partnerClerkUserId,
        partnerName: row.partnerName,
        companyName: row.companyName,
        currency: row.currency ?? "SAR",
        accrued,
        invoiced,
        paid: toNumber(row.paid),
        outstanding: accrued + invoiced,
      };
    })
    .sort((a, b) => b.outstanding - a.outstanding);
};

/**
 * Payouts waiting on a human.
 *
 * A payout is a partner asking to be paid for earnings they have already
 * invoiced. Nothing here is automatic: somebody reads the invoice, makes the
 * transfer, and records it.
 */
export const listPayableQueue = async (): Promise<SelectPartnerPayouts[]> =>
  db
    .select()
    .from(PartnerPayouts)
    .where(eq(PartnerPayouts.status, "requested"))
    .orderBy(desc(PartnerPayouts.createdAt));

/** One partner's earnings, newest first — the detail behind their balance. */
export const listPayableDetail = async (
  partnerClerkUserId: string,
  status?: "accrued" | "invoiced" | "paid",
) =>
  db
    .select()
    .from(PartnerEarnings)
    .where(
      status
        ? and(
            eq(PartnerEarnings.partnerClerkUserId, partnerClerkUserId),
            eq(PartnerEarnings.status, status),
          )
        : eq(PartnerEarnings.partnerClerkUserId, partnerClerkUserId),
    )
    .orderBy(desc(PartnerEarnings.accruedAt));
