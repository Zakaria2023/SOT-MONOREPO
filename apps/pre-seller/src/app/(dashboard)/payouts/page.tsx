import { SettleButton } from "@/components/payouts/settle-button";
import { requirePreSeller } from "@/lib/server/auth";
import { formatSar } from "utils";
import { listPayoutsForReview } from "services";

const PayoutsPage = async () => {
  await requirePreSeller();

  const payouts = await listPayoutsForReview();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl text-ink">Payouts</h1>
        <p className="mt-1 text-sm text-muted">
          Partner cash-out requests awaiting a bank transfer. Marking paid
          clears their ledger.
        </p>
      </div>

      {payouts.length === 0 ? (
        <p className="text-sm text-muted">No pending payouts.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {payouts.map((payout) => (
            <div
              key={payout.uuid}
              className="flex items-center justify-between rounded-card border border-hairline bg-surface p-5"
            >
              <div>
                <p className="font-semibold text-ink">{payout.reference}</p>
                <p className="text-sm text-muted">
                  {formatSar(Number(payout.amount))}
                </p>
              </div>
              <SettleButton payoutUuid={payout.uuid} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PayoutsPage;
