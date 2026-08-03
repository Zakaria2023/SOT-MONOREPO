"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { CategoryFacet } from "services";

type SpecFilterProps = {
  // The facets this category offers the current viewer — already resolved
  // server-side from the assignments (filter on, audience permitted, in scope)
  // with each option list narrowed to the category's enabled slice.
  facets: CategoryFacet[];
  // Chosen values per spec key.
  selected: Record<string, string[]>;
  onToggle: (key: string, value: string) => void;
};

type SpecFacetGroupProps = {
  facet: CategoryFacet;
  selected: string[];
  onToggle: (key: string, value: string) => void;
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
                <span className="flex-1 text-left text-ink">{option.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const SpecFilter = ({ facets, selected, onToggle }: SpecFilterProps) => {
  if (facets.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-hairline bg-surface p-5 shadow-sm">
      {facets.map((facet) => (
        <SpecFacetGroup
          key={facet.key}
          facet={facet}
          selected={selected[facet.key] ?? []}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
};
