"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useState } from "react";
import type { CategoryFacet } from "services";
import type { SpecRange } from "utils";
import { useDebouncedCallback } from "ui";

type SpecFilterProps = {
  // The facets this category offers the current viewer — already resolved
  // server-side from the assignments (filter on, audience permitted, in scope)
  // with each option list narrowed to the category's enabled slice.
  facets: CategoryFacet[];
  // Chosen values per spec key.
  selected: Record<string, string[]>;
  onToggle: (key: string, value: string) => void;
  /** Bounds per numeric facet, and the setter that writes them to the URL. */
  ranges: Record<string, SpecRange>;
  onRange: (key: string, range: SpecRange) => void;
};

type SpecRangeFieldProps = {
  facet: CategoryFacet;
  range: SpecRange;
  onChange: (range: SpecRange) => void;
};

type SpecFacetGroupProps = {
  facet: CategoryFacet;
  selected: string[];
  onToggle: (key: string, value: string) => void;
};

/**
 * A numeric facet: two bounds, either of which may be left open.
 *
 * A `number` attribute has no options to tick — "48 ports or more" is the only
 * question worth asking of it — so it was being dropped from the sidebar
 * entirely, and a filter the catalogue team had switched on simply never
 * appeared.
 *
 * Typing is debounced before it reaches the URL: every keystroke would otherwise
 * be a navigation, and "1" on the way to "100" filters the list down to nothing
 * in front of the shopper.
 */
const SpecRangeField = ({ facet, range, onChange }: SpecRangeFieldProps) => {
  // Seeded from the URL and then owned by the field while it is being typed in.
  // The caller keys this component on the bounds, so a change that did not come
  // from these boxes — clearing the filters, following a shared link — remounts
  // it with the new values rather than syncing them in an effect.
  const [min, setMin] = useState(range.min?.toString() ?? "");
  const [max, setMax] = useState(range.max?.toString() ?? "");

  const commit = useDebouncedCallback((next: { min: string; max: string }) => {
    const toBound = (value: string) => {
      const parsed = Number(value);
      return value.trim() !== "" && Number.isFinite(parsed)
        ? parsed
        : undefined;
    };
    onChange({ min: toBound(next.min), max: toBound(next.max) });
  }, 400);

  const field =
    "font-grotesk w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-primary";

  return (
    <div>
      <p className="font-grotesk text-xs font-semibold tracking-widest text-faint uppercase">
        {facet.label}
        {facet.unit && (
          <span className="ml-1 text-faint normal-case">({facet.unit})</span>
        )}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={min}
          aria-label={`${facet.label} minimum`}
          placeholder="Min"
          onChange={(event) => {
            setMin(event.target.value);
            commit({ min: event.target.value, max });
          }}
          className={field}
        />
        <span className="text-sm text-faint">to</span>
        <input
          type="number"
          inputMode="numeric"
          value={max}
          aria-label={`${facet.label} maximum`}
          placeholder="Max"
          onChange={(event) => {
            setMax(event.target.value);
            commit({ min, max: event.target.value });
          }}
          className={field}
        />
      </div>
    </div>
  );
};

const SpecFacetGroup = ({ facet, selected, onToggle }: SpecFacetGroupProps) => {
  const chosen = new Set(selected);

  return (
    <div>
      <p className="font-grotesk text-xs font-semibold tracking-widest text-faint uppercase">
        {facet.label}
        {facet.unit && (
          <span className="ml-1 normal-case text-faint">({facet.unit})</span>
        )}
      </p>
      {facet.ordered && (
        // An ordered facet is what the shopper HAS, not what they want — say
        // so, or picking 1G looks like it should return only 1G devices.
        <p className="font-grotesk mt-0.5 text-xs normal-case text-faint">
          What you have — shows anything that fits it
        </p>
      )}
      <ul className="mt-2 flex flex-col gap-0.5">
        {facet.options.map((option) => {
          const checked = chosen.has(option.value);
          return (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => onToggle(facet.key, option.value)}
                aria-pressed={checked}
                className="font-grotesk flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-surface-2"
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    checked
                      ? "border-primary bg-primary-solid text-white"
                      : "border-[#D6D3E0] bg-surface",
                  )}
                >
                  {checked && <Check size={13} />}
                </span>
                <span className="flex-1 text-left text-ink">
                  {option.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/**
 * The specification filters, under a heading of their own.
 *
 * Nothing at all when there are no facets — no placeholder card, no invitation.
 * Facets belong to a category, so the catalogue opens without them, and an empty
 * panel sitting under Brands on every unfiltered visit is furniture. The heading
 * exists because when the facets DO arrive they were reading as unlabelled rows
 * below Brands rather than as a third filter.
 */
export const SpecFilter = ({
  facets,
  selected,
  onToggle,
  ranges,
  onRange,
}: SpecFilterProps) => {
  if (facets.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-hairline bg-surface p-5 shadow-sm">
      <p className="font-grotesk text-xs font-semibold tracking-widest text-faint uppercase">
        Specifications
      </p>

      {facets.map((facet) =>
        facet.type === "number" ? (
          <SpecRangeField
            key={`${facet.key}:${ranges[facet.key]?.min ?? ""}:${ranges[facet.key]?.max ?? ""}`}
            facet={facet}
            range={ranges[facet.key] ?? {}}
            onChange={(range) => onRange(facet.key, range)}
          />
        ) : (
          <SpecFacetGroup
            key={facet.key}
            facet={facet}
            selected={selected[facet.key] ?? []}
            onToggle={onToggle}
          />
        ),
      )}
    </div>
  );
};
