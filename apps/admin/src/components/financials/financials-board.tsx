import { getPlatformFinancialsAction } from "@/app/(dashboard)/financials/action";
import { formatMoney } from "utils";

// A11. The half of the money the payables screen must never show.

export const FinancialsBoard = async () => {
  const summary = await getPlatformFinancialsAction();

  if (summary.months.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-4 py-8 text-center text-xs text-faint">
        No orders yet, so there is nothing to report.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Revenue", value: summary.revenue },
          { label: "Partner cost", value: summary.partnerCost },
          { label: "Margin", value: summary.margin },
        ].map((figure) => (
          <div
            key={figure.label}
            className="flex flex-col gap-1 rounded-card border border-hairline bg-surface px-4 py-3"
          >
            <span className="text-xs tracking-wide text-faint uppercase">
              {figure.label}
            </span>
            <span className="font-heading text-2xl text-ink">
              {formatMoney(figure.value, summary.currency)}
            </span>
          </div>
        ))}
      </div>

      {/* Null rather than 0% when there is no revenue: "we made nothing on what
          we sold" and "we sold nothing" are different statements. */}
      <p className="text-sm text-muted">
        {summary.orders} order{summary.orders === 1 ? "" : "s"}
        {summary.marginPercent !== null &&
          ` · margin is ${summary.marginPercent.toFixed(1)}% of revenue`}
        . Margin here is revenue less what partners are owed — it carries no
        overhead, logistics or tax, so it is not profit.
      </p>

      <div className="flex flex-col gap-2">
        {summary.months.map((month) => (
          <div
            key={month.month}
            className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm text-ink">
                {new Date(month.month).toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="text-[11px] text-muted">
                {month.orders} order{month.orders === 1 ? "" : "s"} ·{" "}
                {formatMoney(month.revenue, month.currency)} in ·{" "}
                {formatMoney(month.partnerCost, month.currency)} out
              </p>
            </div>
            <span className="font-heading text-lg text-ink">
              {formatMoney(month.margin, month.currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
