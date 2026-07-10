import { OfferForm } from "@/components/offers/offer-form";
import { formatMoney, offerTotal } from "utils";
import { requirePartner } from "@/lib/server/auth";
import { ArrowLeft, MessageSquare } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getApprovedPartnerByClerkId,
  getPartnerBoq,
  getPartnerOffer,
} from "services";
import type { OfferInput } from "validators";

type Props = {
  params: Promise<{ uuid: string }>;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning-tint text-warning",
  approved: "bg-success-tint text-success",
  rejected: "bg-danger-tint text-danger",
  selected: "bg-primary-tint text-primary",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending admin review",
  approved: "Approved — awaiting the customer",
  rejected: "Rejected",
  selected: "Selected by the customer",
};

const BoqDetailPage = async ({ params }: Props) => {
  const user = await requirePartner();

  const { uuid } = await params;
  const [detail, partner, offer] = await Promise.all([
    getPartnerBoq(user.id, uuid),
    getApprovedPartnerByClerkId(user.id),
    getPartnerOffer(user.id, uuid),
  ]);
  if (!detail) {
    notFound();
  }

  const { boq, items } = detail;
  const currency = items[0]?.currency ?? "SAR";
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0,
  );
  const showProgramming = partner?.serviceScope === "install-program";
  const editable =
    !offer || offer.status === "pending" || offer.status === "rejected";

  const defaultValues: OfferInput = {
    productPrice: offer?.productPrice ?? "",
    installPrice: offer?.installPrice ?? "",
    programmingPrice: offer?.programmingPrice ?? "",
    description: offer?.description ?? "",
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/boqs"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} />
          Incoming BOQs
        </Link>

        <h1 className="font-heading mt-3 text-2xl text-ink">{boq.reference}</h1>
        <p className="mt-1 text-sm text-muted">
          {items.length} {items.length === 1 ? "item" : "items"}
        </p>
      </div>

      <div className="overflow-hidden rounded-card border border-hairline bg-surface shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
        {items.map((item, index) => (
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
            </div>
            <div className="flex items-center gap-6">
              <p className="text-sm text-muted">Qty {item.quantity}</p>
              <p className="w-28 text-right font-semibold tabular-nums text-ink">
                {formatMoney(Number(item.unitPrice) * item.quantity, currency)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted">
        Catalog subtotal:{" "}
        <span className="font-medium text-ink">
          {formatMoney(subtotal, currency)}
        </span>
      </p>

      {detail.preSellerComment && (
        <div className="rounded-card border border-hairline bg-surface p-6 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
          <h2 className="flex items-center gap-2 font-heading text-lg text-ink">
            <MessageSquare size={18} className="text-primary" />
            Note from the pre-seller
          </h2>
          <p className="mt-2 text-sm whitespace-pre-wrap text-secondary">
            {detail.preSellerComment}
          </p>
        </div>
      )}

      <section className="rounded-card border border-hairline bg-surface p-6 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
        <h2 className="font-heading text-xl text-ink">Your offer</h2>
        <p className="mt-1 text-sm text-muted">
          Price the product, installation
          {showProgramming ? " and programming" : ""}, and describe what you
          deliver. The admin reviews it before the customer sees it.
        </p>

        {offer && (
          <div className="mt-5 flex flex-col gap-3">
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                STATUS_STYLES[offer.status] ?? "bg-hover text-muted"
              }`}
            >
              {STATUS_LABELS[offer.status] ?? offer.status}
            </span>
            {offer.status === "rejected" && offer.rejectionReason && (
              <p className="rounded-control bg-danger-tint p-3 text-sm text-danger">
                {offer.rejectionReason}
              </p>
            )}
            <p className="text-sm text-muted">
              Current total:{" "}
              <span className="font-semibold text-ink">
                {formatMoney(offerTotal(offer), currency)}
              </span>
            </p>
          </div>
        )}

        {editable ? (
          <div className="mt-6">
            <OfferForm
              boqUuid={boq.uuid}
              showProgramming={showProgramming}
              submitLabel={offer ? "Update offer" : "Send offer"}
              defaultValues={defaultValues}
            />
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2 rounded-control bg-hover p-4 text-sm text-muted">
            <div className="flex justify-between">
              <span>Product</span>
              <span className="font-medium text-ink">
                {formatMoney(Number(offer?.productPrice ?? 0), currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Installation</span>
              <span className="font-medium text-ink">
                {formatMoney(Number(offer?.installPrice ?? 0), currency)}
              </span>
            </div>
            {offer?.programmingPrice && (
              <div className="flex justify-between">
                <span>Programming</span>
                <span className="font-medium text-ink">
                  {formatMoney(Number(offer.programmingPrice), currency)}
                </span>
              </div>
            )}
            {offer?.description && (
              <p className="mt-2 whitespace-pre-wrap text-secondary">
                {offer.description}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default BoqDetailPage;
