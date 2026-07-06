import { requirePreSeller } from "@/lib/server/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBoq } from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

const money = (amount: number, currency: string | null) =>
  `${currency ?? "SAR"} ${Math.round(amount).toLocaleString("en-US")}`;

const BoqDetailPage = async ({ params }: Props) => {
  await requirePreSeller();

  const { uuid } = await params;
  const detail = await getBoq(uuid);
  if (!detail) {
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

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <Link
        href="/boqs"
        className="text-sm font-medium text-neutral-500 transition-colors hover:text-primary"
      >
        ← Review queue
      </Link>

      <h1 className="font-heading mt-4 text-4xl font-extrabold text-ink">
        {boq.reference}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {items.length} {items.length === 1 ? "item" : "items"} · status:{" "}
        {boq.status}
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
              <p className="font-heading text-base font-bold text-ink">
                {item.name}
              </p>
              <p className="text-xs text-neutral-500">
                {money(Number(item.unitPrice), currency)} each
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-neutral-500">Qty {item.quantity}</p>
              <p className="font-bold tabular-nums text-ink">
                {money(Number(item.unitPrice) * item.quantity, currency)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-end gap-1 text-sm text-neutral-600">
        <div>Subtotal: {money(subtotal, currency)}</div>
        <div>VAT (15%): {money(vat, currency)}</div>
        <div className="mt-1 text-lg font-extrabold text-ink">
          Total: {money(total, currency)}
        </div>
      </div>
    </main>
  );
};

export default BoqDetailPage;
