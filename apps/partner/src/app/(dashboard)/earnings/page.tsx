import { CashOutButton } from "@/components/earnings/cash-out-button";
import {
  PARTNER_EARNING_STATUS_LABELS,
  PARTNER_PAYOUT_STATUS_LABELS,
} from "@/db/label";
import { requirePartner } from "@/lib/server/auth";
import { formatSar } from "utils";
import {
  getPartnerEarningsSummary,
  listPartnerEarnings,
  listPartnerPayouts,
} from "services";

const PartnerEarningsPage = async () => {
  const user = await requirePartner();

  const [summary, payouts, earnings] = await Promise.all([
    getPartnerEarningsSummary(user.id),
    listPartnerPayouts(user.id),
    // The lines behind the tiles. This screen showed three totals and a list of
    // payout references, so the only thing a partner could do with a figure they
    // disagreed with was ring somebody up.
    listPartnerEarnings(user.id),
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
        <h2 className="font-heading text-lg text-ink">
          What made up those totals
        </h2>
        <p className="mt-1 text-sm text-muted">
          One line per handover. A figure you cannot break down is a figure you
          cannot check.
        </p>
        {earnings.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Nothing accrued yet. A line appears here when a job you installed is
            verified.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {earnings.map((earning) => (
              <div
                key={earning.uuid}
                className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-hairline px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  {/* The BOQ reference is the number on the job they went to
                      site for. The order reference is ours, and shown only when
                      there is no BOQ to name. */}
                  <p className="text-ink">
                    {earning.boqReference ??
                      earning.orderReference ??
                      "a job that has since been removed"}
                  </p>
                  <p className="text-xs text-muted">
                    {PARTNER_EARNING_STATUS_LABELS[earning.status]} ·{" "}
                    {new Date(earning.accruedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="font-semibold tabular-nums text-ink">
                  {formatSar(Number(earning.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

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
