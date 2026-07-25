"use client";

import type { ShopperPreview } from "@/app/(dashboard)/assignments/actions";
import type { DraftRow } from "@/components/assignments/assignment-workspace";
import type { AssignmentAudience } from "@/db/enum";
import { Boxes, Tags } from "lucide-react";
import { useState } from "react";
import { firstFacetFailure, type FacetChoice } from "utils";

type ShopperPanelTabProps = {
  rows: DraftRow[];
  preview: ShopperPreview;
  viewingAs: AssignmentAudience;
};

type PreviewItemProps = {
  name: string;
  path?: string | null;
  kind: "category" | "product";
  reason: string | null;
};

// Widest to narrowest — a viewer sees an assignment when their own rank is at
// least the assignment's.
const AUDIENCE_RANK: Record<AssignmentAudience, number> = {
  all: 0,
  partner: 1,
  staff: 2,
};

const PreviewItem = ({ name, path, kind, reason }: PreviewItemProps) => (
  <li
    className={
      reason
        ? "flex items-center gap-2 rounded-control border border-hairline bg-page px-3 py-2 opacity-45"
        : "flex items-center gap-2 rounded-control border border-hairline bg-page px-3 py-2"
    }
  >
    {kind === "category" ? (
      <Tags size={14} className="shrink-0 text-faint" />
    ) : (
      <Boxes size={14} className="shrink-0 text-faint" />
    )}
    {path && <span className="font-mono text-[10px] text-faint">{path}</span>}
    <span className="line-clamp-1 flex-1 text-sm text-ink">{name}</span>
    {reason && (
      <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
        {reason}
      </span>
    )}
  </li>
);

export const ShopperPanelTab = ({
  rows,
  preview,
  viewingAs,
}: ShopperPanelTabProps) => {
  const [chosen, setChosen] = useState<Record<string, string>>({});

  // The facets this category offers this viewer: filter on, audience allows,
  // and either authored here or inherited as branch-wide.
  const facets = rows.filter(
    (row) =>
      row.isFilter &&
      AUDIENCE_RANK[row.audience] <= AUDIENCE_RANK[viewingAs] &&
      (!row.inherited || row.scope === "branch") &&
      row.offeredOptions.length > 0,
  );

  const choices: FacetChoice[] = Object.entries(chosen).flatMap(
    ([specKey, value]) => {
      const row = rows.find((entry) => entry.key === specKey);
      if (!row || !value) {
        return [];
      }
      // An ordered attribute makes the choice a ceiling; the master list is
      // the scale it ranks against.
      return [
        {
          specKey,
          value,
          ...(row.ordered ? { scale: row.masterOptions } : {}),
        },
      ];
    },
  );

  const pick = (specKey: string, value: string) =>
    setChosen((current) => ({
      ...current,
      [specKey]: current[specKey] === value ? "" : value,
    }));

  const greyed =
    preview.categories.filter((category) =>
      Boolean(firstFacetFailure(category.offeredByKey, choices)),
    ).length +
    preview.products.filter((product) =>
      Boolean(firstFacetFailure(product.offeredByKey, choices)),
    ).length;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex shrink-0 flex-col gap-4 lg:w-64">
        <p className="text-xs font-semibold tracking-widest text-faint uppercase">
          Filters a shopper sees
        </p>

        {facets.length === 0 ? (
          <p className="rounded-control border border-dashed border-hairline p-4 text-xs text-faint">
            No attribute on this category is set to show as a filter for this
            audience. Turn Filter on in Assignments.
          </p>
        ) : (
          facets.map((facet) => (
            <div key={facet.specificationUuid}>
              <p className="text-xs font-semibold text-ink">
                {facet.label}
                {facet.unit && (
                  <span className="ml-1 font-normal text-faint">
                    ({facet.unit})
                  </span>
                )}
                {facet.ordered && (
                  <span className="ml-1.5 rounded bg-primary-tint px-1 py-0.5 text-[10px] font-medium text-primary">
                    ceiling
                  </span>
                )}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {facet.offeredOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => pick(facet.key, option)}
                    aria-pressed={chosen[facet.key] === option}
                    className={
                      chosen[facet.key] === option
                        ? "rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-white"
                        : "rounded-md border border-hairline bg-page px-2 py-1 text-[11px] text-muted transition-colors hover:border-primary"
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-widest text-faint uppercase">
          Beneath this category
          {greyed > 0 && (
            <span className="ml-2 normal-case text-amber-700">
              {greyed} greyed out
            </span>
          )}
        </p>

        {preview.categories.length === 0 && preview.products.length === 0 ? (
          <p className="mt-3 rounded-control border border-dashed border-hairline p-6 text-center text-xs text-faint">
            Nothing sits beneath this category yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {/* Categories grey out on what their SLICE can offer — a category
                whose Frequency Band slice is 2.4/5 cannot serve 6GHz. */}
            {preview.categories.map((category) => (
              <PreviewItem
                key={category.uuid}
                name={category.name}
                path={category.path}
                kind="category"
                reason={
                  firstFacetFailure(category.offeredByKey, choices)?.reason ??
                  null
                }
              />
            ))}
            {/* Products grey out on the values they actually carry. */}
            {preview.products.map((product) => (
              <PreviewItem
                key={product.uuid}
                name={product.name}
                kind="product"
                reason={
                  firstFacetFailure(product.offeredByKey, choices)?.reason ??
                  null
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
