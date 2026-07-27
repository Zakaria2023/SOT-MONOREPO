"use client";

import type { PredicateAttribute } from "@/components/assignments/condition-picker";
import { Field } from "@/components/shared/field";
import type { LookupTable, Predicate } from "@/db/types";
import { Plus, X } from "lucide-react";
import { Dropdown, Input } from "ui";

// The Conditional family's table. The limit is not supplied by another product —
// it is read from here, keyed by the item's OWN other values.
//
// Cat6 at 10G runs 55 m while Cat6A at 10G runs 100 m, so the same measured
// length passes or fails depending on the grade and speed of the very same item.
//
// A row reads: if A = x and B = y, then the limit is n. Rows are tried top to
// bottom and the first match wins, which is why a specific row has to sit above
// a catch-all — and why the order is the author's to set, not alphabetical.

type LookupEditorProps = {
  value: LookupTable;
  onChange: (next: LookupTable) => void;
  attributes: PredicateAttribute[];
};

type LookupLimitProps = {
  rows: LookupTable["rows"];
  limitAttr: string;
  attributes: PredicateAttribute[];
  onLimitAttr: (uuid: string) => void;
  onLimit: (at: number, limit: number) => void;
};

type RowEditorProps = {
  when: Predicate | null;
  limit: number;
  attributes: PredicateAttribute[];
  onChange: (when: Predicate | null, limit: number) => void;
  onRemove?: () => void;
  index: number;
};

// A row's condition is a flat AND of "attribute = value" pairs. Deliberately
// flat: a lookup key with nested OR inside it is a rule nobody can read back.
type Clause = { attr: string; value: string };

// A row before anything is picked. `when` cannot be null in the stored shape,
// and an `exists` on no attribute matches nothing — which is the honest reading
// of a half-authored row.
const BLANK_ROW: LookupTable["rows"][number] = {
  when: { op: "exists", attr: "" },
  limit: 0,
};

const toClauses = (predicate: Predicate | null): Clause[] => {
  const one = (node: Predicate): Clause | null => {
    if (node.op === "equals") {
      return { attr: node.attr, value: String(node.value) };
    }
    if (node.op === "in" && node.values.length > 0) {
      return { attr: node.attr, value: String(node.values[0]) };
    }
    if (node.op === "exists") {
      return { attr: node.attr, value: "" };
    }
    return null;
  };

  if (!predicate) {
    return [];
  }
  if (predicate.op === "all") {
    return predicate.children.flatMap((child) => {
      const clause = one(child);
      return clause ? [clause] : [];
    });
  }
  const clause = one(predicate);
  return clause ? [clause] : [];
};

const toPredicate = (
  clauses: Clause[],
  attributes: PredicateAttribute[],
): Predicate | null => {
  const children: Predicate[] = clauses
    .filter((clause) => clause.attr !== "")
    .map((clause) => {
      if (clause.value === "") {
        return { op: "exists", attr: clause.attr };
      }
      // A typed number is stored as a NUMBER, not as the string that was typed.
      // `in` on a numeric attribute would compare "55" against 55 by way of
      // String(), which happens to work and happens to stop working the moment
      // anyone writes 55.0.
      const attribute = attributes.find((entry) => entry.uuid === clause.attr);
      if (attribute?.type === "number") {
        return { op: "equals", attr: clause.attr, value: Number(clause.value) };
      }
      if (attribute?.type === "boolean") {
        return {
          op: "equals",
          attr: clause.attr,
          value: clause.value === "true",
        };
      }
      return {
        op: "in",
        attr: clause.attr,
        values: [clause.value],
        mode: "any",
      };
    });
  const only = children[0];
  if (!only) {
    return null;
  }
  return children.length === 1 ? only : { op: "all", children };
};

const RowEditor = ({
  when,
  limit,
  attributes,
  onChange,
  onRemove,
  index,
}: RowEditorProps) => {
  // Always two slots, because that shape IS the common case: a grade and a
  // speed, a material and a diameter. An empty second slot does not become a
  // clause, so "if A = x" alone is written by leaving it be.
  const clauses = toClauses(when);
  const slots: Clause[] = [
    clauses[0] ?? { attr: "", value: "" },
    clauses[1] ?? { attr: "", value: "" },
  ];

  const setSlot = (at: number, patch: Partial<Clause>): void => {
    onChange(
      toPredicate(
        slots.map((slot, position) =>
          position === at ? { ...slot, ...patch } : slot,
        ),
        attributes,
      ),
      limit,
    );
  };

  const typeOf = (attr: string) =>
    attributes.find((entry) => entry.uuid === attr)?.type;

  const optionsFor = (attr: string) =>
    (attributes.find((entry) => entry.uuid === attr)?.options ?? [])
      .filter((option) => !option.retired)
      .map((option) => ({ value: option.value, label: option.label }));

  const attributeOptions = attributes.map((entry) => ({
    value: entry.uuid,
    label: entry.unit ? `${entry.label} (${entry.unit})` : entry.label,
  }));

  return (
    <div className="flex flex-col gap-2">
      {onRemove && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-secondary">
            Row {index + 1}
          </span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove row ${index + 1}`}
            className="rounded-control p-1 text-faint hover:bg-hover hover:text-red-400"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {slots.map((slot, at) => (
        <div key={at} className="flex flex-col gap-1.5">
          <span className="text-xs text-secondary">
            {at === 0 ? "if" : "and"}
          </span>
          <Dropdown
            value={slot.attr}
            onChange={(attr) => setSlot(at, { attr, value: "" })}
            options={attributeOptions}
            searchable
            placeholder="— attribute —"
          />
          <div className="flex items-center gap-2">
            <span className="w-3 shrink-0 text-sm text-faint">=</span>
            <div className="min-w-0 flex-1">
              {typeOf(slot.attr) === "number" ? (
                <Input
                  type="number"
                  placeholder="value"
                  value={slot.value}
                  onChange={(event) =>
                    setSlot(at, { value: event.target.value })
                  }
                />
              ) : typeOf(slot.attr) === "boolean" ? (
                <Dropdown
                  value={slot.value}
                  onChange={(value) => setSlot(at, { value })}
                  options={[
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" },
                  ]}
                  placeholder="value"
                />
              ) : (
                <Dropdown
                  value={slot.value}
                  onChange={(value) => setSlot(at, { value })}
                  options={optionsFor(slot.attr)}
                  placeholder="value"
                  emptyMessage="Pick an attribute first"
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const LookupEditor = ({
  value,
  onChange,
  attributes,
}: LookupEditorProps) => {
  // One row is what the form shows by default. More than one is what the family
  // is FOR — Cat6 at 55 m and Cat6A at 100 m are two rows of one rule, not two
  // rules — so adding another is one click rather than a second relation.
  const rows = value.rows.length > 0 ? value.rows : [BLANK_ROW];

  return (
    <Field label="When (all conditions true)">
      <div className="flex flex-col gap-4">
        {rows.map((row, at) => (
          <RowEditor
            key={at}
            index={at}
            when={row.when}
            limit={row.limit}
            attributes={attributes}
            onChange={(when, limit) =>
              onChange({
                ...value,
                rows: rows.map((current, position) =>
                  position === at
                    ? { when: when ?? { op: "exists", attr: "" }, limit }
                    : current,
                ),
              })
            }
            onRemove={
              rows.length > 1
                ? () =>
                    onChange({
                      ...value,
                      rows: rows.filter((_, position) => position !== at),
                    })
                : undefined
            }
          />
        ))}

        <button
          type="button"
          onClick={() => onChange({ ...value, rows: [...rows, BLANK_ROW] })}
          className="flex w-fit items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
        >
          <Plus size={13} />
          Another combination
        </button>
      </div>
    </Field>
  );
};

/**
 * The limit side, authored beside the table rather than inside it.
 *
 * The attribute being measured is the same for every row — repeating it per row
 * invites two rows that measure different things, which is a rule that cannot
 * be explained. Only the number varies.
 */
export const LookupLimit = ({
  rows,
  limitAttr,
  attributes,
  onLimitAttr,
  onLimit,
}: LookupLimitProps) => (
  <Field label="Then limit">
    <Dropdown
      value={limitAttr}
      onChange={onLimitAttr}
      options={attributes.map((entry) => ({
        value: entry.uuid,
        label: entry.unit ? `${entry.label} (${entry.unit})` : entry.label,
      }))}
      searchable
      placeholder="— attribute —"
    />
    <div className="flex flex-col gap-2 pt-1">
      {(rows.length > 0 ? rows : [BLANK_ROW]).map((row, at) => (
        <div key={at} className="flex items-center gap-2">
          <span className="w-3 shrink-0 text-sm text-faint">≤</span>
          <div className="min-w-0 flex-1">
            <Input
              type="number"
              value={String(row.limit)}
              onChange={(event) => onLimit(at, Number(event.target.value))}
            />
          </div>
          {rows.length > 1 && (
            <span className="shrink-0 text-[11px] text-faint">
              row {at + 1}
            </span>
          )}
        </div>
      ))}
    </div>
  </Field>
);
