import { OfferForm } from "@/components/offers/offer-form";
import { formatMoney, offerTotal } from "@/lib/helpers";
import { requirePartner } from "@/lib/server/auth";
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
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  selected: "bg-primary/10 text-primary",
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
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <Link
        href="/boqs"
        className="text-sm font-medium text-neutral-500 transition-colors hover:text-primary"
      >
        ← Incoming BOQs
      </Link>

      <h1 className="font-heading mt-4 text-4xl text-ink">{boq.reference}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {items.length} {items.length === 1 ? "item" : "items"}
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200">
        {items.map((item, index) => (
          <div
            key={item.uuid}
            className={`flex items-center justify-between gap-4 p-5 ${
              index > 0 ? "border-t border-neutral-100" : ""
            }`}
          >
            <div>
              {item.categoryName && (
                <p className="text-xs text-neutral-400">{item.categoryName}</p>
              )}
              <p className="font-heading text-base font-semibold text-ink">
                {item.name}
              </p>
              <p className="text-xs text-neutral-500">
                {formatMoney(Number(item.unitPrice), currency)} each
              </p>
            </div>
            <div className="flex items-center gap-6">
              <p className="text-sm text-neutral-500">Qty {item.quantity}</p>
              <p className="w-28 text-right font-semibold tabular-nums text-ink">
                {formatMoney(Number(item.unitPrice) * item.quantity, currency)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-right text-sm text-neutral-600">
        Catalog subtotal: {formatMoney(subtotal, currency)}
      </p>

      <section className="mt-10 rounded-2xl border border-neutral-200 p-6">
        <h2 className="font-heading text-2xl text-ink">Your offer</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Price the product, installation
          {showProgramming ? " and programming" : ""}, and describe what you
          deliver. The admin reviews it before the customer sees it.
        </p>

        {offer && (
          <div className="mt-5 flex flex-col gap-3">
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                STATUS_STYLES[offer.status] ?? "bg-neutral-100 text-neutral-600"
              }`}
            >
              {STATUS_LABELS[offer.status] ?? offer.status}
            </span>
            {offer.status === "rejected" && offer.rejectionReason && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {offer.rejectionReason}
              </p>
            )}
            <p className="text-sm text-neutral-600">
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
          <div className="mt-5 flex flex-col gap-2 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600">
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
              <p className="mt-2 whitespace-pre-wrap text-neutral-600">
                {offer.description}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
};

export default BoqDetailPage;
