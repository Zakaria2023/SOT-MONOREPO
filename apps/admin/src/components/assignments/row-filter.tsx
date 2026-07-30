"use client";

import type { Operand, Predicate, SpecGroupField } from "@/db/types";
import type { PredicateAttribute } from "@/components/assignments/condition-picker";
import { Dropdown } from "ui";

// ---------------------------------------------------------------------------
// Narrowing WHICH rows a side totals — "how many 10G ports", not "how many
// ports".
//
// Deliberately not a general condition builder. It offers one value list per
// PICK column of the group, and the reading is fixed the same way the condition
// picker fixes it: OR within a column (a row's speed cannot be both 1G and 10G),
// AND across columns (speed and family are separate questions). That is the only
// reading that is ever correct, so making an author choose it would be asking a
// question with one right answer.
//
// The reason it has to exist at all: ticking "any row is 10G" and "any row is
// SFP" as two conditions is a different question, and it says yes to a switch
// whose SFP cage is 1G and whose 10G port is RJ45. A filter is what makes it one
// row that is both.
// ---------------------------------------------------------------------------

type RowFilterProps = {
  operand: Operand | null;
  attributes: PredicateAttribute[];
  onChange: (next: Operand) => void;
};

// What this editor can say, as a value list per column.
type Draft = Record<string, string[]>;

type DecodedFilter = {
  draft: Draft;
  // False when the stored filter says something richer than a value list per
  // column. The editor then refuses to edit rather than rewriting it — the same
  // call the condition picker makes, and for the same reason: silently
  // simplifying a live rule is worse than not editing it.
  exact: boolean;
};

const groupOf = (
  operand: Operand | null,
  attributes: PredicateAttribute[],
): PredicateAttribute | null => {
  if (!operand || operand.source !== "spec" || !operand.groupField) {
    return null;
  }
  const attribute = attributes.find((entry) => entry.uuid === operand.specUuid);
  return attribute?.type === "group" ? attribute : null;
};

const decode = (
  where: Predicate | undefined,
  fields: SpecGroupField[],
): DecodedFilter => {
  if (!where) {
    return { draft: {}, exact: true };
  }
  const draft: Draft = {};
  const one = (node: Predicate): boolean => {
    if (node.op !== "in" || node.mode !== "any") {
      return false;
    }
    if (!fields.some((field) => field.key === node.attr)) {
      return false;
    }
    // Two lists for one column would mean "10G and also 1G" on a single row,
    // which no row can satisfy. Refusing to show it keeps the editor from
    // presenting an impossible filter as an ordinary one.
    if (draft[node.attr]) {
      return false;
    }
    draft[node.attr] = node.values.map(String);
    return true;
  };

  if (where.op === "all") {
    return { draft, exact: where.children.every(one) };
  }
  return { draft, exact: one(where) };
};

const encode = (draft: Draft): Predicate | undefined => {
  const children: Predicate[] = Object.entries(draft)
    .filter(([, values]) => values.length > 0)
    .map(([attr, values]) => ({
      op: "in" as const,
      attr,
      values,
      mode: "any" as const,
    }));
  const only = children[0];
  if (!only) {
    // Absent, never an empty filter: a filter that keeps everything and one that
    // was never set have to serialise the same, or an untouched rule would look
    // edited.
    return undefined;
  }
  return children.length === 1 ? only : { op: "all", children };
};

export const RowFilter = ({
  operand,
  attributes,
  onChange,
}: RowFilterProps) => {
  const group = groupOf(operand, attributes);
  if (!group || !operand || operand.source !== "spec") {
    return null;
  }
  const columns = group.groupFields.filter(
    (field) => field.kind === "select" && field.options.length > 0,
  );
  if (columns.length === 0) {
    return null;
  }

  const { draft, exact } = decode(operand.where, group.groupFields);

  if (!exact) {
    return (
      <div className="flex flex-col gap-2 rounded-control border border-hairline bg-base px-3 py-2.5">
        <span className="text-[11px] text-muted">
          This side already counts only some rows, in a way this editor cannot
          show. It keeps working exactly as it is.
        </span>
        <button
          type="button"
          onClick={() => onChange({ ...operand, where: undefined })}
          className="self-start rounded-control px-2 py-1 text-[11px] text-primary hover:bg-hover"
        >
          Count every row instead
        </button>
      </div>
    );
  }

  const set = (key: string, values: string[]): void => {
    onChange({ ...operand, where: encode({ ...draft, [key]: values }) });
  };

  return (
    <div className="flex flex-col gap-2 rounded-control border border-hairline bg-base px-3 py-2.5">
      <span className="text-[11px] font-semibold tracking-wide text-faint uppercase">
        Count only some rows
      </span>
      {columns.map((column) => (
        <Dropdown
          key={column.key}
          multiple
          value={draft[column.key] ?? []}
          onChange={(next) => set(column.key, next)}
          options={column.options
            .filter((option) => !option.retired)
            .map((option) => ({ value: option.value, label: option.label }))}
          placeholder={`Any ${column.label}`}
        />
      ))}
      <span className="text-[11px] leading-relaxed text-muted">
        Left blank, every row is counted. Picking values in two columns means a
        row has to match both — that is what tells a 10G SFP uplink apart from a
        1G SFP cage next to a 10G RJ45 port.
      </span>
    </div>
  );
};
