import { BoqLineSupply } from "@/components/boqs/boq-line-supply";
import { SendToPartnersDialog } from "@/components/boqs/send-to-partners-dialog";
import { formatMoney, lineTotal, summarizeCart } from "utils";
import { requirePreSeller } from "@/lib/server/auth";
import { MapPin, MessageSquare } from "lucide-react";
import { notFound } from "next/navigation";
import {
  getAssignedBoq,
  getBoqPartners,
  getBoqPartnerOptions,
} from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

const BoqDetailPage = async ({ params }: Props) => {
  const user = await requirePreSeller();

  const { uuid } = await params;
  const detail = await getAssignedBoq(user.id, uuid);
  if (!detail) {
    notFound();
  }

  const { boq, items } = detail;
  const currency = items[0]?.currency ?? "SAR";
  const { subtotal, vat, total } = summarizeCart(items);
  const isDraft = boq.status === "draft";
  const partnerOptions = isDraft
    ? await getBoqPartnerOptions({ preSellerId: user.id, boqUuid: uuid })
    : { close: [], others: [] };
  const partners = isDraft ? [] : await getBoqPartners(uuid);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading mt-3 text-2xl text-ink">{boq.reference}</h1>
        <p className="mt-1 text-sm text-muted">
          {items.length} {items.length === 1 ? "item" : "items"} · Read-only
          review
        </p>
      </div>

      <div className="overflow-hidden rounded-card border border-hairline bg-surface shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
        {items.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            This BOQ has no items.
          </p>
        ) : (
          items.map((item, index) => (
            <div
              key={item.uuid}
              className={`flex items-center justify-between gap-4 p-5 ${
                index > 0 ? "border-t border-hairline-soft" : ""
              }`}
            >
              <div>
                {item.categoryName && (
                  <p className="text-xs text-faint">{item.categoryName}</p>
                )}
                <p className="font-heading text-base text-ink">{item.name}</p>
                <p className="text-xs text-muted">
                  {formatMoney(Number(item.unitPrice), currency)} each
                </p>
                {/* P11, at the point of quoting. The order path refuses a BOQ
                    containing something we cannot supply — so without this a
                    pre-seller prices a design, sends it, and the customer meets
                    the refusal at the moment they try to pay. Better to know
                    before the quote goes out than to withdraw it after. */}
                <BoqLineSupply item={item} />
              </div>
              <div className="flex items-center gap-6">
                <p className="text-sm text-muted">Qty {item.quantity}</p>
                <p className="w-28 text-right font-semibold tabular-nums text-ink">
                  {formatMoney(
                    lineTotal(item.unitPrice, item.quantity),
                    currency,
                  )}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col items-start gap-1 text-sm text-muted">
        <div>Subtotal: {formatMoney(subtotal, currency)}</div>
        <div>VAT (15%): {formatMoney(vat, currency)}</div>
        <div className="mt-1 text-lg text-ink">
          Total: {formatMoney(total, currency)}
        </div>
      </div>

      {isDraft ? (
        <SendToPartnersDialog
          boqUuid={boq.uuid}
          closePartners={partnerOptions.close}
          otherPartners={partnerOptions.others}
        />
      ) : (
        <div className="rounded-card border border-hairline bg-surface p-6 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
          <h2 className="font-heading text-lg text-ink">
            Sent to {partners.length}{" "}
            {partners.length === 1 ? "partner" : "partners"}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Same-city matches first, then any hand-picked partners.
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {partners.map((partner) => (
              <li
                key={partner.uuid}
                className="flex flex-col gap-2 rounded-control bg-hover px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">
                      {partner.partnerName}
                    </p>
                    {partner.partnerLocation && (
                      <p className="flex items-center gap-1 text-xs text-muted">
                        <MapPin size={12} />
                        {partner.partnerLocation}
                      </p>
                    )}
                  </div>
                  {partner.matchRank && partner.matchRank > 0 ? (
                    <span className="rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-semibold text-primary">
                      #{partner.matchRank}
                    </span>
                  ) : (
                    <span className="rounded-full bg-hover px-2.5 py-0.5 text-xs font-semibold text-secondary">
                      Hand-picked
                    </span>
                  )}
                </div>
                {partner.preSellerComment && (
                  <p className="flex items-start gap-2 text-sm whitespace-pre-wrap text-secondary">
                    <MessageSquare
                      size={14}
                      className="mt-0.5 shrink-0 text-primary"
                    />
                    {partner.preSellerComment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default BoqDetailPage;
