import { documentDownloadUrl } from "@/lib/documents";
import {
  BOQ_ITEM_ROLE_LABELS,
  BOQ_LINE_TYPE_LABELS,
  BOQ_STATUS_LABELS,
} from "@/db/label";
import { Box, ImageOff, Package, Wrench } from "lucide-react";
import Image from "next/image";
import { formatMoney, formatSar } from "utils";
import type { AdminBoqDetail, AdminBoqItem } from "services";

type BoqDetailProps = {
  detail: AdminBoqDetail;
};

type ItemCardProps = {
  item: AdminBoqItem;
  currency: string;
};

const lineTotal = (item: AdminBoqItem) => Number(item.unitPrice) * item.quantity;

const ItemCard = ({ item, currency }: ItemCardProps) => (
  <div className="flex gap-4 rounded-card border border-hairline bg-surface p-4 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
    <div className="shrink-0">
      {item.productImage ? (
        <Image
          src={documentDownloadUrl(item.productImage)}
          alt={item.name}
          width={64}
          height={64}
          unoptimized
          className="h-16 w-16 rounded-control object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-control bg-hover text-faint">
          {item.lineType === "service" ? (
            <Wrench size={20} />
          ) : (
            <ImageOff size={20} />
          )}
        </div>
      )}
    </div>

    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{item.name}</p>
          <p className="text-xs text-muted">
            {[item.brandName, item.productModel].filter(Boolean).join(" · ") ||
              "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums text-ink">
            {formatMoney(lineTotal(item), currency)}
          </p>
          <p className="text-xs text-muted">
            {formatMoney(Number(item.unitPrice), currency)} × {item.quantity}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {item.lineType === "service" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-tint px-2 py-0.5 text-xs font-medium text-warning">
            <Wrench size={11} />
            {BOQ_LINE_TYPE_LABELS.service}
          </span>
        )}
        {item.role && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary">
            <Box size={11} />
            {BOQ_ITEM_ROLE_LABELS[item.role]}
          </span>
        )}
        {item.categoryName && (
          <span className="rounded-full bg-hover px-2 py-0.5 text-xs text-muted">
            {item.categoryName}
          </span>
        )}
        {item.productSku && (
          <span className="rounded-full bg-hover px-2 py-0.5 text-xs text-muted">
            SKU {item.productSku}
          </span>
        )}
      </div>
    </div>
  </div>
);

export const BoqDetail = ({ detail }: BoqDetailProps) => {
  const { boq, customerName, sections, items } = detail;
  const currency = items[0]?.currency ?? "SAR";
  const status = boq.status ?? "draft";
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Group lines by their section; anything without one falls into a default.
  const bySection = new Map<string, AdminBoqItem[]>();
  for (const item of items) {
    const key = item.sectionUuid ?? "ungrouped";
    const group = bySection.get(key) ?? [];
    group.push(item);
    bySection.set(key, group);
  }
  const orderedSections = [
    ...sections.map((section) => ({
      uuid: section.uuid,
      name: section.name,
    })),
    ...(bySection.has("ungrouped")
      ? [{ uuid: "ungrouped", name: "Other items" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-hairline bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl text-ink">{boq.reference}</h1>
            <p className="mt-1 text-sm text-muted">
              {customerName ?? "—"}
              {boq.site ? ` · ${boq.site}` : ""}
            </p>
          </div>
          <span className="rounded-full bg-hover px-3 py-1 text-xs font-semibold text-ink">
            {BOQ_STATUS_LABELS[status]}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-xs text-faint">Items</p>
            <p className="font-semibold text-ink">{itemCount}</p>
          </div>
          <div>
            <p className="text-xs text-faint">Lines</p>
            <p className="font-semibold text-ink">{items.length}</p>
          </div>
          <div>
            <p className="text-xs text-faint">Subtotal (MSRP)</p>
            <p className="font-semibold text-ink">{formatSar(subtotal)}</p>
          </div>
          {boq.assignedPreSellerName && (
            <div>
              <p className="text-xs text-faint">Pre-seller</p>
              <p className="font-semibold text-ink">
                {boq.assignedPreSellerName}
              </p>
            </div>
          )}
        </div>
      </div>

      {orderedSections.map((section) => {
        const sectionItems = bySection.get(section.uuid) ?? [];
        if (sectionItems.length === 0) {
          return null;
        }
        return (
          <section key={section.uuid}>
            <h2 className="mb-3 flex items-center gap-2 font-heading text-lg text-ink">
              <Package size={18} className="text-primary" />
              {section.name}
            </h2>
            <div className="flex flex-col gap-3">
              {sectionItems.map((item) => (
                <ItemCard key={item.uuid} item={item} currency={currency} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};
