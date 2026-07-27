"use client";

import {
  ConditionPicker,
  describePredicate,
  type PredicateAttribute,
} from "@/components/assignments/condition-picker";
import { FieldSet } from "@/components/shared/field";
import type { LookupTable, Predicate } from "@/db/types";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Input } from "ui";

// The Conditional family's table. The limit is not supplied by another product —
// it is read from here, keyed by the item's OWN other values.
//
// Cat6 at 10G runs 55 m while Cat6A at 10G runs 100 m, so the same measured
// length passes or fails depending on the grade and speed of the very same item.
// Rows are tried in author order, which is why the ordering controls matter: a
// specific row has to sit above a catch-all or the catch-all wins first.

type LookupEditorProps = {
  value: LookupTable;
  onChange: (next: LookupTable) => void;
  attributes: PredicateAttribute[];
};

export const LookupEditor = ({
  value,
  onChange,
  attributes,
}: LookupEditorProps) => {
  const setRow = (
    index: number,
    when: Predicate | null,
    limit: number,
  ): void => {
    onChange({
      ...value,
      rows: value.rows.map((row, at) =>
        at === index
          ? {
              when: when ?? { op: "exists", attr: attributes[0]?.uuid ?? "" },
              limit,
            }
          : row,
      ),
    });
  };

  const move = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= value.rows.length) {
      return;
    }
    const rows = [...value.rows];
    const a = rows[index];
    const b = rows[target];
    if (!a || !b) {
      return;
    }
    rows[index] = b;
    rows[target] = a;
    onChange({ ...value, rows });
  };

  return (
    <FieldSet
      title="Limit table"
      hint="Rows are tried top to bottom and the first match wins, so put the specific combinations above the catch-all. An item matching no row is outside what the table describes and is left alone."
    >
      {value.rows.length === 0 && (
        <p className="rounded-control border border-dashed border-hairline px-3 py-4 text-center text-[11px] text-faint">
          No rows yet — a conditional rule with an empty table cannot run.
        </p>
      )}

      {value.rows.map((row, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-control border border-hairline bg-base p-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-secondary">
              Row {index + 1}
              {index === value.rows.length - 1 && value.rows.length > 1 && (
                <span className="ml-1.5 text-faint">(last — the fallback)</span>
              )}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Move row up"
                className="rounded-control p-1 text-faint hover:bg-hover hover:text-ink disabled:opacity-40"
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === value.rows.length - 1}
                aria-label="Move row down"
                className="rounded-control p-1 text-faint hover:bg-hover hover:text-ink disabled:opacity-40"
              >
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    rows: value.rows.filter((_, at) => at !== index),
                  })
                }
                aria-label="Remove row"
                className="rounded-control p-1 text-faint hover:bg-hover hover:text-red-400"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          <ConditionPicker
            value={row.when}
            onChange={(when) => setRow(index, when, row.limit)}
            attributes={attributes}
            emptyLabel="Matches anything"
          />

          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] text-secondary">
              then the limit is
            </span>
            <Input
              type="number"
              value={String(row.limit)}
              onChange={(event) =>
                setRow(index, row.when, Number(event.target.value))
              }
            />
          </div>

          <p className="text-[11px] text-faint">
            {describePredicate(row.when, attributes)} → {row.limit}
          </p>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          onChange({
            ...value,
            rows: [
              ...value.rows,
              {
                when: { op: "exists", attr: attributes[0]?.uuid ?? "" },
                limit: 0,
              },
            ],
          })
        }
        className="flex w-fit items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
      >
        <Plus size={13} />
        Add row
      </button>
    </FieldSet>
  );
};
