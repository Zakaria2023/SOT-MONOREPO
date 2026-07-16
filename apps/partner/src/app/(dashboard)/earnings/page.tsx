import { CashOutButton } from "@/components/earnings/cash-out-button";
import { PARTNER_PAYOUT_STATUS_LABELS } from "@/db/label";
import { requirePartner } from "@/lib/server/auth";
import { formatSar } from "utils";
import {
  getPartnerEarningsSummary,
  listPartnerPayouts,
} from "services";

const PartnerEarningsPage = async () => {
  const user = await requirePartner();

  const [summary, payouts] = await Promise.all([
    getPartnerEarningsSummary(user.id),
    listPartnerPayouts(user.id),
  ]);

  const tiles = [
    { label: "Owed to you", value: summary.accrued },
    { label: "Invoiced", value: summary.invoiced },
    { label: "Paid", value: summary.paid },
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl text-ink">Earnings</h1>
        <p className="mt-1 text-sm text-muted">
          What SOT owes you for verified handovers. Amounts appear here after a
          system is handed over — this is money owed to you, not a stored
          balance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-card border border-hairline bg-surface p-5"
          >
            <p className="text-xs text-muted">{tile.label}</p>
            <p className="mt-1 font-heading text-xl text-ink">
              {formatSar(tile.value)}
            </p>
          </div>
        ))}
      </div>

      <CashOutButton disabled={summary.accrued <= 0} />

      <section>
        <h2 className="font-heading text-lg text-ink">Payouts</h2>
        {payouts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No payouts yet.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {payouts.map((payout) => (
              <div
                key={payout.uuid}
                className="flex items-center justify-between rounded-control border border-hairline px-4 py-3 text-sm"
              >
                <span className="text-ink">{payout.reference}</span>
                <span className="text-muted">
                  {PARTNER_PAYOUT_STATUS_LABELS[payout.status]}
                  {payout.auto ? " · auto" : ""}
                </span>
                <span className="font-semibold tabular-nums text-ink">
                  {formatSar(Number(payout.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default PartnerEarningsPage;
