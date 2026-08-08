import { getProductAuditAction } from "@/app/(dashboard)/products/action";
import {
  CATALOG_AUDIT_ACTION_LABELS,
  CATALOG_AUDIT_TARGET_LABELS,
} from "@/db/label";

// What has happened to this product, beside the product.
//
// The catalogue-wide activity feed was built once and taken out for being
// unreadable. The question is almost never "what happened today" — it is "why
// does this say what it says", and that only makes sense next to the thing.

type ProductHistoryProps = {
  productUuid: string;
};

export const ProductHistory = async ({ productUuid }: ProductHistoryProps) => {
  const entries = await getProductAuditAction(productUuid);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-faint">
        Nothing recorded yet. Changes from here on will show up.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <div key={entry.uuid} className="flex flex-col gap-0.5">
          <p className="text-sm text-ink">
            {CATALOG_AUDIT_ACTION_LABELS[entry.action]}{" "}
            <span className="text-muted">
              {CATALOG_AUDIT_TARGET_LABELS[entry.target].toLowerCase()}
            </span>{" "}
            {entry.targetLabel}
          </p>
          <p className="text-[11px] text-faint">
            {entry.actorName ?? "System"} ·{" "}
            {new Date(entry.createdAt).toLocaleString()}
          </p>
          {(entry.changes ?? []).length > 0 && (
            <div className="flex flex-col gap-0.5 pl-3">
              {(entry.changes ?? []).map((change) => (
                <p key={change.field} className="text-[11px] text-secondary">
                  {change.field}:{" "}
                  <span className="font-mono">
                    {String(change.from ?? "—")} → {String(change.to ?? "—")}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
