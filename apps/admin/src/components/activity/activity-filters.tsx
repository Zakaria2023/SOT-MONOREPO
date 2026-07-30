import type { CatalogAuditAction, CatalogAuditTarget } from "@/db/enum";
import {
  CATALOG_AUDIT_ACTION_LABELS,
  CATALOG_AUDIT_TARGET_LABELS,
} from "@/db/label";
import { filterHref } from "@/lib/filter-href";
import { catalogAuditActions, catalogAuditTargets } from "@/db/enum";
import Link from "next/link";

type ActivityFiltersProps = {
  filters: Record<string, string | undefined>;
  // Set when the trail has been narrowed to one row's history. Named so the
  // screen can say WHAT it is showing the history of — "filtered" with nothing to
  // point at is the state an author cannot get out of.
  itemLabel?: string;
};

type ChipProps = {
  href: string;
  active: boolean;
  label: string;
};

const Chip = ({ href, active, label }: ChipProps) => (
  <Link
    href={href}
    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
      active
        ? "border-primary bg-primary text-white"
        : "border-hairline text-secondary hover:bg-hover"
    }`}
  >
    {label}
  </Link>
);

export const ActivityFilters = ({
  filters,
  itemLabel,
}: ActivityFiltersProps) => (
  <div className="flex flex-col gap-3">
    {filters.item && (
      <div className="flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-surface px-4 py-2.5 text-sm">
        <span className="text-muted">
          Showing the history of{" "}
          <span className="font-semibold text-ink">
            {itemLabel ?? "one item"}
          </span>
        </span>
        <Link
          href={filterHref("/activity", filters, { item: "" })}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Show everything
        </Link>
      </div>
    )}

    <div className="flex flex-wrap items-center gap-2">
      <Chip
        href={filterHref("/activity", filters, { target: "" })}
        active={!filters.target}
        label="Everything"
      />
      {catalogAuditTargets.map((target: CatalogAuditTarget) => (
        <Chip
          key={target}
          href={filterHref("/activity", filters, {
            target: filters.target === target ? "" : target,
          })}
          active={filters.target === target}
          label={CATALOG_AUDIT_TARGET_LABELS[target]}
        />
      ))}
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <Chip
        href={filterHref("/activity", filters, { action: "" })}
        active={!filters.action}
        label="Any change"
      />
      {catalogAuditActions.map((action: CatalogAuditAction) => (
        <Chip
          key={action}
          href={filterHref("/activity", filters, {
            action: filters.action === action ? "" : action,
          })}
          active={filters.action === action}
          label={CATALOG_AUDIT_ACTION_LABELS[action]}
        />
      ))}
    </div>
  </div>
);
