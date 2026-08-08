import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { Orders } from "../../../db/schema/orders";
import { PartnerEarnings } from "../../../db/schema/payouts";

// ---------------------------------------------------------------------------
// A11 — WHAT THE PLATFORM MADE.
//
// The other half of the split. Revenue, what it cost us in partner payables,
// and the margin between them.
//
// Deliberately a separate module from A10 rather than a wider query behind one
// screen. A finance clerk processing partner invoices must not see platform
// margin, and the cheapest way to guarantee that is for the payables code to
// have no path to these numbers at all — not a flag, not a role check inside a
// shared function, which is one careless `if` away from leaking.
// ---------------------------------------------------------------------------

export type PlatformPeriod = {
  // ISO date, first day of the month.
  month: string;
  currency: string;
  orders: number;
  // What customers were charged, net of their partner discount — the order
  // grand totals as written.
  revenue: number;
  // What those orders accrued to partners. The platform's cost of delivery.
  partnerCost: number;
  // Revenue minus partner cost. NOT profit: it carries no overhead, no
  // logistics, no tax. Named `margin` and not `profit` on purpose, because a
  // number labelled profit gets quoted in places this one cannot support.
  margin: number;
};

export type PlatformSummary = {
  currency: string;
  orders: number;
  revenue: number;
  partnerCost: number;
  margin: number;
  // Margin as a percentage of revenue, or null when there is no revenue to be a
  // percentage of. Zero would read as "we made nothing on what we sold", which
  // is a different statement from "we sold nothing".
  marginPercent: number | null;
  months: PlatformPeriod[];
};

const toNumber = (value: string | number | null): number => Number(value ?? 0);

/**
 * Revenue, partner cost and margin, by month.
 *
 * Two aggregate queries — orders and earnings — joined in memory by month
 * rather than in SQL. A single join over both would multiply order rows by
 * earning rows and silently overstate revenue, which is the classic way a
 * financial summary comes out wrong and looks plausible.
 */
export const getPlatformFinancials = async (): Promise<PlatformSummary> => {
  const [orderRows, earningRows] = await Promise.all([
    db
      .select({
        month: sql<string>`DATE_FORMAT(${Orders.createdAt}, '%Y-%m-01')`,
        currency: sql<string>`MIN(${Orders.currency})`,
        orders: sql<number>`COUNT(*)`,
        revenue: sql<string>`SUM(${Orders.grandTotal})`,
      })
      .from(Orders)
      .groupBy(sql`DATE_FORMAT(${Orders.createdAt}, '%Y-%m-01')`),
    db
      .select({
        month: sql<string>`DATE_FORMAT(${PartnerEarnings.accruedAt}, '%Y-%m-01')`,
        partnerCost: sql<string>`SUM(${PartnerEarnings.amount})`,
      })
      .from(PartnerEarnings)
      .groupBy(sql`DATE_FORMAT(${PartnerEarnings.accruedAt}, '%Y-%m-01')`),
  ]);

  const costByMonth = new Map(
    earningRows.map((row) => [row.month, toNumber(row.partnerCost)] as const),
  );

  // Every month either side has activity in. A month with cost and no revenue
  // is a real and interesting state — work delivered against orders placed
  // earlier — and dropping it would hide it.
  const months = new Set([
    ...orderRows.map((row) => row.month),
    ...costByMonth.keys(),
  ]);

  const byMonth = new Map(orderRows.map((row) => [row.month, row] as const));

  const periods: PlatformPeriod[] = [...months]
    .sort()
    .map((month) => {
      const order = byMonth.get(month);
      const revenue = toNumber(order?.revenue ?? 0);
      const partnerCost = costByMonth.get(month) ?? 0;
      return {
        month,
        currency: order?.currency ?? "SAR",
        orders: order?.orders ?? 0,
        revenue,
        partnerCost,
        margin: revenue - partnerCost,
      };
    });

  const revenue = periods.reduce((sum, period) => sum + period.revenue, 0);
  const partnerCost = periods.reduce(
    (sum, period) => sum + period.partnerCost,
    0,
  );

  return {
    currency: periods[0]?.currency ?? "SAR",
    orders: periods.reduce((sum, period) => sum + period.orders, 0),
    revenue,
    partnerCost,
    margin: revenue - partnerCost,
    marginPercent:
      revenue === 0 ? null : ((revenue - partnerCost) / revenue) * 100,
    months: periods,
  };
};
