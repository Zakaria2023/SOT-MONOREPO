"use client";

import type { PredicateAttribute } from "@/components/assignments/condition-picker";
import type { Operand } from "@/db/types";
import { Dropdown, Input, type DropdownOption } from "ui";

// One side of a rule. Not every rule compares two product attributes:
//
//   spec       — a product attribute (the common case)
//   variable   — a number the BUYER supplied, which is what lets "expected
//                concurrent calls ≤ PBX capacity" exist at all
//   item_count — how many matching items are in the selection, so Count is the
//                same evaluator with a different source rather than its own path
//   constant   — a fixed number authored on the rule
//
// One operand type keeps a single evaluator instead of a special case per family.

export type OperandVariable = {
  uuid: string;
  label: string;
  unit: string | null;
};

type OperandPickerProps = {
  value: Operand | null;
  onChange: (next: Operand | null) => void;
  attributes: PredicateAttribute[];
  variables: OperandVariable[];
  // Only the Count family measures a number of items.
  allowItemCount?: boolean;
};

type Source = Operand["source"];

const sourceOf = (value: Operand | null): Source | "" =>
  value ? value.source : "";

export const OperandPicker = ({
  value,
  onChange,
  attributes,
  variables,
  allowItemCount = false,
}: OperandPickerProps) => {
  const sourceOptions: DropdownOption[] = [
    { value: "spec", label: "A product attribute" },
    ...(variables.length > 0
      ? [{ value: "variable", label: "Something the buyer tells us" }]
      : []),
    ...(allowItemCount
      ? [{ value: "item_count", label: "How many matching items" }]
      : []),
    { value: "constant", label: "A fixed number" },
  ];

  const changeSource = (next: string): void => {
    const source = next as Source;
    if (source === "spec") {
      const first = attributes[0];
      onChange(first ? { source: "spec", specUuid: first.uuid } : null);
      return;
    }
    if (source === "variable") {
      const first = variables[0];
      onChange(first ? { source: "variable", variableUuid: first.uuid } : null);
      return;
    }
    if (source === "item_count") {
      onChange({ source: "item_count" });
      return;
    }
    onChange({ source: "constant", value: 0 });
  };

  const attributeOptions: DropdownOption[] = attributes.map((attribute) => ({
    value: attribute.uuid,
    label: attribute.unit
      ? `${attribute.label} (${attribute.unit})`
      : attribute.label,
  }));

  const variableOptions: DropdownOption[] = variables.map((variable) => ({
    value: variable.uuid,
    label: variable.unit
      ? `${variable.label} (${variable.unit})`
      : variable.label,
  }));

  return (
    <div className="flex flex-col gap-2">
      <Dropdown
        value={sourceOf(value)}
        onChange={changeSource}
        options={sourceOptions}
        placeholder="Select…"
      />

      {value?.source === "spec" && (
        <Dropdown
          value={value.specUuid}
          onChange={(specUuid) => onChange({ source: "spec", specUuid })}
          options={attributeOptions}
          searchable
        />
      )}

      {value?.source === "variable" && (
        <Dropdown
          value={value.variableUuid}
          onChange={(variableUuid) =>
            onChange({ source: "variable", variableUuid })
          }
          options={variableOptions}
        />
      )}

      {value?.source === "item_count" && (
        <p className="rounded-control bg-hover px-2.5 py-2 text-[11px] text-muted">
          Counts the quantity of every item matching the filter below — two NVRs
          count as two, not one line.
        </p>
      )}

      {value?.source === "constant" && (
        <Input
          type="number"
          value={String(value.value)}
          onChange={(event) =>
            onChange({ source: "constant", value: Number(event.target.value) })
          }
        />
      )}
    </div>
  );
};
