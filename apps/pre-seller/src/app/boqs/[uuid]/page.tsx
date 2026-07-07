import { BoqItemControls } from "@/components/boqs/boq-item-controls";
import { formatMoney } from "@/lib/helpers";
import { requirePreSeller } from "@/lib/server/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBoq } from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

const BoqDetailPage = async ({ params }: Props) => {
  const user = await requirePreSeller();

  const { uuid } = await params;
  const detail = await getBoq(uuid);
  if (!detail || detail.boq.assignedPreSellerId !== user.id) {
    notFound();
  }

  const { boq, items } = detail;
  const currency = items[0]?.currency ?? "SAR";
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0,
  );
  const vat = subtotal * 0.15;
  const total = subtotal + vat;
  const isDraft = boq.status === "draft";

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <Link
        href="/boqs"
        className="text-sm font-medium text-neutral-500 transition-colors hover:text-primary"
      >
        ← Assigned BOQs
      </Link>

      <h1 className="font-heading mt-4 text-4xl text-ink">{boq.reference}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {items.length} {items.length === 1 ? "item" : "items"} · status:{" "}
        {boq.status}
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200">
        {items.length === 0 ? (
          <p className="p-8 text-center text-neutral-500">
            This BOQ has no items left.
          </p>
        ) : (
          items.map((item, index) => (
            <div
              key={item.uuid}
              className={`flex items-center justify-between gap-4 p-5 ${
                index > 0 ? "border-t border-neutral-100" : ""
              }`}
            >
              <div>
                {item.categoryName && (
                  <p className="text-xs text-neutral-400">
                    {item.categoryName}
                  </p>
                )}
                <p className="font-heading text-base font-semibold text-ink">
                  {item.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {formatMoney(Number(item.unitPrice), currency)} each
                </p>
              </div>
              <div className="flex items-center gap-6">
                {isDraft ? (
                  <BoqItemControls
                    boqUuid={boq.uuid}
                    boqItemUuid={item.uuid}
                    quantity={item.quantity}
                  />
                ) : (
                  <p className="text-sm text-neutral-500">
                    Qty {item.quantity}
                  </p>
                )}
                <p className="w-28 text-right font-semibold tabular-nums text-ink">
                  {formatMoney(Number(item.unitPrice) * item.quantity, currency)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 flex flex-col items-end gap-1 text-sm text-neutral-600">
        <div>Subtotal: {formatMoney(subtotal, currency)}</div>
        <div>VAT (15%): {formatMoney(vat, currency)}</div>
        <div className="mt-1 text-lg text-ink">
          Total: {formatMoney(total, currency)}
        </div>
      </div>

      {isDraft && (
        <div className="mt-8 flex flex-col items-end gap-2">
          <button
            type="button"
            disabled
            className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white opacity-40"
          >
            Submit BOQ
          </button>
          <p className="text-xs text-neutral-400">
            Submission is coming next — for now you can edit the draft.
          </p>
        </div>
      )}
    </main>
  );
};

export default BoqDetailPage;
