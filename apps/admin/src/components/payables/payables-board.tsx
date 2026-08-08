import {
  getPayableQueueAction,
  getPayablesAction,
} from "@/app/(dashboard)/payables/action";
import { MarkPaidButton } from "@/components/payables/mark-paid-button";
import { formatMoney } from "utils";

// A10. What we owe, and what is waiting to be transferred.
//
// There is no revenue or margin anywhere on this screen, and that is not a
// layout decision — the service behind it cannot reach those numbers at all.

export const PayablesBoard = async () => {
  const [payables, queue] = await Promise.all([
    getPayablesAction(),
    getPayableQueueAction(),
  ]);

  const outstanding = payables.reduce(
    (sum, payable) => sum + payable.outstanding,
    0,
  );
  const currency = payables[0]?.currency ?? "SAR";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4 rounded-card border border-hairline bg-base px-4 py-3">
        <span className="text-sm text-secondary">
          <span className="font-heading text-xl text-ink">
            {formatMoney(outstanding, currency)}
          </span>{" "}
          owed across {payables.length} partner
          {payables.length === 1 ? "" : "s"}
        </span>
        {queue.length > 0 && (
          <span className="text-sm text-amber-500">
            {queue.length} waiting to be transferred
          </span>
        )}
      </div>

      {queue.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-lg text-ink">Waiting on a transfer</h2>
          {queue.map((payout) => (
            <div
              key={payout.uuid}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-ink">{payout.reference}</p>
                <p className="text-[11px] text-muted">
                  Requested {new Date(payout.requestedAt).toLocaleDateString()}
                  {payout.auto && " · raised automatically at handover"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-heading text-lg text-ink">
                  {formatMoney(Number(payout.amount), payout.currency ?? "SAR")}
                </span>
                <MarkPaidButton payoutUuid={payout.uuid} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-lg text-ink">Balances</h2>
        {payables.length === 0 ? (
          <p className="rounded-card border border-dashed border-hairline px-4 py-8 text-center text-xs text-faint">
            Nothing owed. Earnings accrue when a handover is verified.
          </p>
        ) : (
          payables.map((payable) => (
            <div
              key={payable.partnerClerkUserId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-ink">
                  {payable.companyName ?? payable.partnerName ?? "Unknown partner"}
                </p>
                <p className="text-[11px] text-muted">
                  {formatMoney(payable.accrued, payable.currency)} accrued ·{" "}
                  {formatMoney(payable.invoiced, payable.currency)} invoiced ·{" "}
                  {formatMoney(payable.paid, payable.currency)} paid to date
                </p>
              </div>
              <span className="font-heading text-lg text-ink">
                {formatMoney(payable.outstanding, payable.currency)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
