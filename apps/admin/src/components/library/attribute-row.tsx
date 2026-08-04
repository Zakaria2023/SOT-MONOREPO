"use client";

import { ASSIGNMENT_AUDIENCE_LABELS } from "@/db/label";

import { ArrowUpDown, Library, Link2, Pencil, Trash2 } from "lucide-react";
import { TYPE_META, TypeIcon } from "@/components/library/library-shared";
import type { LibraryAttribute } from "@/components/library/library-shared";
/** One attribute as it appears in a group's list. */
export const AttributeRow = ({
  attribute,
  onEdit,
  onDelete,
}: {
  attribute: LibraryAttribute;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const meta = TYPE_META[attribute.type];
  const live = attribute.options.filter((option) => !option.retired);
  const referenced = attribute.relationshipCount > 0;

  return (
    <div className="flex items-start gap-3 rounded-card border border-hairline bg-surface px-3 py-2.5">
      <div className="mt-0.5">
        <TypeIcon type={attribute.type} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">
            {attribute.label}
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.className}`}
          >
            {meta.badge}
          </span>
          {attribute.unit && (
            <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
              {attribute.unit}
            </span>
          )}
          {attribute.ordered && (
            <span className="flex items-center gap-1 rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
              <ArrowUpDown size={9} />
              scale
            </span>
          )}
          {/* Worth its own badge: the options below are borrowed, so editing them
              is not done here, and this attribute's values are comparable with
              every other attribute carrying the same badge. */}
          {attribute.optionSetUuid && (
            <span className="flex items-center gap-1 rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
              <Library size={9} />
              shared list
            </span>
          )}
          {attribute.allowRange && (
            <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
              range
            </span>
          )}
          {attribute.audience !== "everyone" && (
            <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
              {ASSIGNMENT_AUDIENCE_LABELS[attribute.audience]}
            </span>
          )}
        </div>

        {live.length > 0 && (
          <p className="mt-1 line-clamp-1 text-xs text-muted">
            {/* Listed in rank order for an ordered attribute, so the sequence
                itself is the information — the numbers behind it are noise. */}
            {live.map((option) => option.label).join(" · ")}
          </p>
        )}

        {/* A group has no master option list, so the line above is always empty
            for one. Its sub-fields in column order are the equivalent summary —
            they are what one stored row actually looks like. */}
        {attribute.groupFields.length > 0 && (
          <p className="mt-1 line-clamp-1 text-xs text-muted">
            {attribute.groupFields.map((field) => field.label).join(" · ")}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-faint">
          {referenced && (
            <span className="flex items-center gap-1 text-primary">
              <Link2 size={10} />
              {attribute.relationshipCount} rule
              {attribute.relationshipCount === 1 ? "" : "s"}
            </span>
          )}
          <span>
            {attribute.categoryCount} categor
            {attribute.categoryCount === 1 ? "y" : "ies"}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${attribute.label}`}
          className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-ink"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${attribute.label}`}
          className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};
