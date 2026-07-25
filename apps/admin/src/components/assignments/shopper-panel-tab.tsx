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

type FacetRowProps = {
  facet: DraftRow;
  badge: "ceiling" | "inclusion";
  caption: string;
  chosen: string;
  onPick: (specKey: string, value: string) => void;
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

const FacetRow = ({ facet, badge, caption, chosen, onPick }: FacetRowProps) => (
  <div>
    <p className="flex flex-wrap items-center gap-1.5">
      <span
        className={
          badge === "ceiling"
            ? "rounded bg-primary-tint px-1 py-0.5 text-[10px] font-semibold text-primary"
            : "rounded bg-amber-50 px-1 py-0.5 text-[10px] font-semibold text-amber-700"
        }
      >
        {badge}
      </span>
      <span className="text-xs font-semibold text-ink">{facet.label}</span>
      <span className="text-[11px] text-faint">— {caption}</span>
    </p>
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onPick(facet.key, chosen)}
        aria-pressed={!chosen}
        className={
          !chosen
            ? "rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-white"
            : "rounded-md border border-hairline bg-surface px-2 py-1 text-[11px] text-muted transition-colors hover:border-primary"
        }
      >
        Any
      </button>
      {facet.offeredOptions.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onPick(facet.key, option)}
          aria-pressed={chosen === option}
          className={
            chosen === option
              ? "rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-white"
              : "rounded-md border border-hairline bg-surface px-2 py-1 text-[11px] text-muted transition-colors hover:border-primary"
          }
        >
          {option}
        </button>
      ))}
    </div>
  </div>
);

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

  // Ordered attributes are ceilings, unordered are inclusions — grouped so
  // the panel says which kind of statement each chip makes.
  const scaleFacets = facets.filter((facet) => facet.ordered);
  const setFacets = facets.filter((facet) => !facet.ordered);

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
      <div className="flex shrink-0 flex-col gap-4 lg:w-72">
        {facets.length === 0 ? (
          <p className="rounded-control border border-dashed border-hairline p-4 text-xs text-faint">
            No attribute on this category is set to show as a filter for this
            audience. Turn Filter on in Assignments.
          </p>
        ) : (
          <>
            {/* The shopper states what they HAVE. An ordered attribute reads
                as a ceiling ("my network gives 1G"), an unordered one as a
                requirement ("it must do 6GHz"). Same chips, opposite meaning,
                so they are labelled rather than left to be inferred. */}
            {scaleFacets.length + setFacets.length > 0 && (
              <div className="flex flex-col gap-3 rounded-control border border-hairline bg-page p-3">
                <p className="text-[11px] font-semibold tracking-widest text-faint uppercase">
                  Your infrastructure
                </p>
                {scaleFacets.map((facet) => (
                  <FacetRow
                    key={facet.specificationUuid}
                    facet={facet}
                    badge="ceiling"
                    caption="your infrastructure max"
                    chosen={chosen[facet.key] ?? ""}
                    onPick={pick}
                  />
                ))}
                {setFacets.map((facet) => (
                  <FacetRow
                    key={facet.specificationUuid}
                    facet={facet}
                    badge="inclusion"
                    caption="must include"
                    chosen={chosen[facet.key] ?? ""}
                    onPick={pick}
                  />
                ))}
              </div>
            )}

            <p className="text-[11px] text-muted">
              Facets use each attribute&apos;s enabled slice, not the whole
              master list.
            </p>
          </>
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
