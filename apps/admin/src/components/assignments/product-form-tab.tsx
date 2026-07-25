"use client";

import type { DraftRow } from "@/components/assignments/assignment-workspace";
import type { AssignmentAudience } from "@/db/enum";
import { EyeOff, Zap } from "lucide-react";
import { useState } from "react";
import { Dropdown, Input } from "ui";

type ProductFormTabProps = {
  rows: DraftRow[];
  viewingAs: AssignmentAudience;
};

const AUDIENCE_RANK: Record<AssignmentAudience, number> = {
  all: 0,
  partner: 1,
  staff: 2,
};

export const ProductFormTab = ({ rows, viewingAs }: ProductFormTabProps) => {
  const [values, setValues] = useState<Record<string, string>>({});

  const permitted = rows.filter(
    (row) => AUDIENCE_RANK[row.audience] <= AUDIENCE_RANK[viewingAs],
  );

  // Show-if, run to a fixed point: hiding a controller hides whatever depends
  // on it. Bounded by the row count so a circular condition can't spin.
  let visible = permitted;
  for (let pass = 0; pass <= permitted.length; pass += 1) {
    const present = new Set(visible.map((row) => row.key));
    const next = visible.filter((row) => {
      if (!row.showIf) {
        return true;
      }
      if (!present.has(row.showIf.specKey)) {
        return false;
      }
      const chosen = (values[row.showIf.specKey] ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      return chosen.some((value) => row.showIf?.values.includes(value));
    });
    if (next.length === visible.length) {
      break;
    }
    visible = next;
  }

  const hidden = permitted.length - visible.length;

  const setValue = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        What a product in this category is asked to fill in. Attributes appear
        and disappear as their show-if conditions change — and when one
        disappears its value is cleared, so the engine never sizes off a number
        that no longer applies.
        {hidden > 0 && (
          <span className="ml-1 font-semibold text-amber-700">
            {hidden} hidden right now.
          </span>
        )}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-control border border-dashed border-hairline p-8 text-center text-sm text-faint">
          Nothing to fill in for this audience.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map((row) => (
            <div key={row.specificationUuid} className="flex flex-col gap-1.5">
              <label className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink">
                {row.label}
                {row.unit && (
                  <span className="font-normal text-faint">({row.unit})</span>
                )}
                {!row.isFilter && row.isRule && (
                  <span className="flex items-center gap-0.5 rounded bg-primary-tint px-1 py-0.5 text-[10px] font-medium text-primary">
                    <Zap size={9} />
                    rule only
                  </span>
                )}
                {row.audience !== "all" && (
                  <span className="rounded bg-surface px-1 py-0.5 text-[10px] font-medium text-muted">
                    {row.audience}
                  </span>
                )}
                {row.showIf && (
                  <span className="flex items-center gap-0.5 text-[10px] text-faint">
                    <EyeOff size={9} />
                    conditional
                  </span>
                )}
              </label>

              {row.offeredOptions.length > 0 ? (
                <Dropdown
                  value={values[row.key] ?? ""}
                  onChange={(value) => {
                    setValue(row.key, value);
                    // Clearing, not just hiding: drop the stored value of
                    // anything this choice hides.
                    setValues((current) => {
                      const next = { ...current, [row.key]: value };
                      for (const other of rows) {
                        if (other.showIf?.specKey !== row.key) {
                          continue;
                        }
                        if (!other.showIf.values.includes(value)) {
                          delete next[other.key];
                        }
                      }
                      return next;
                    });
                  }}
                  placeholder="Not set"
                  options={[
                    { value: "", label: "Not set" },
                    ...row.offeredOptions.map((option) => ({
                      value: option,
                      label: option,
                    })),
                  ]}
                />
              ) : (
                <Input
                  type={row.valueType === "number" ? "number" : "text"}
                  value={values[row.key] ?? ""}
                  onChange={(event) => setValue(row.key, event.target.value)}
                  placeholder={row.unit ? `Value in ${row.unit}` : "Value"}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
