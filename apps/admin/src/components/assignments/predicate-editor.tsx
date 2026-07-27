"use client";

import type {
  MatchMode,
  PredicateOperator,
  SpecificationType,
} from "@/db/enum";
import { MATCH_MODE_LABELS, PREDICATE_OPERATOR_LABELS } from "@/db/label";
import type { Predicate, SpecOption } from "@/db/types";
import { Plus, X } from "lucide-react";
import { Dropdown, Input, type DropdownOption } from "ui";

// ---------------------------------------------------------------------------
// THE condition editor. One component, used everywhere a condition is authored:
//
//   - the conditional reveal on an assignment ("show PoE Budget when PoE = Yes")
//   - which items count as consumers on a rule
//   - which items count as providers on a rule
//   - a row of a conditional rule's lookup table
//   - a presence trigger, and each way a requirement can be satisfied
//
// One editor because there is one predicate language. Five editors is how the
// same "if PoE = Yes" ends up expressible five ways and answering differently in
// each.
// ---------------------------------------------------------------------------

// The attribute list the editor picks from. Structural, so both the assignment
// tab and the relation builder can hand it whatever they already have loaded.
export type PredicateAttribute = {
  uuid: string;
  label: string;
  type: SpecificationType;
  ordered: boolean;
  unit: string | null;
  options: SpecOption[];
};

type PredicateEditorProps = {
  value: Predicate | null;
  onChange: (next: Predicate | null) => void;
  attributes: PredicateAttribute[];
  // Wording for the empty state, since "always shown" and "everything
  // participates" are the same condition read two different ways.
  emptyLabel?: string;
  depth?: number;
};

type LeafEditorProps = {
  value: Extract<Predicate, { attr: string }>;
  onChange: (next: Predicate) => void;
  onRemove: () => void;
  attributes: PredicateAttribute[];
};

// Which operators make sense for a type. Offering "is at most" on an unordered
// list is how an author builds a condition that silently never matches.
const operatorsFor = (
  attribute: PredicateAttribute | undefined,
): PredicateOperator[] => {
  if (!attribute) {
    return ["exists"];
  }
  if (attribute.type === "number") {
    return ["gte", "lte", "gt", "lt", "between", "exists"];
  }
  if (attribute.type === "boolean") {
    return ["equals", "exists"];
  }
  const base: PredicateOperator[] = [
    "in",
    "not_in",
    "equals",
    "not_equals",
    "exists",
  ];
  return attribute.ordered ? [...base, "lte", "gte"] : base;
};

const NUMERIC_OPS: PredicateOperator[] = ["gt", "gte", "lt", "lte"];

const isGroup = (
  predicate: Predicate,
): predicate is Extract<Predicate, { op: "all" | "any" }> =>
  predicate.op === "all" || predicate.op === "any";

const isLeaf = (
  predicate: Predicate,
): predicate is Extract<Predicate, { attr: string }> => "attr" in predicate;

/** A sensible starting predicate for a freshly picked attribute. */
const defaultFor = (attribute: PredicateAttribute): Predicate => {
  if (attribute.type === "number") {
    return { op: "gte", attr: attribute.uuid, value: 0 };
  }
  if (attribute.type === "boolean") {
    return { op: "equals", attr: attribute.uuid, value: true };
  }
  return { op: "in", attr: attribute.uuid, values: [], mode: "any" };
};

const LeafEditor = ({
  value,
  onChange,
  onRemove,
  attributes,
}: LeafEditorProps) => {
  const attribute = attributes.find((entry) => entry.uuid === value.attr);
  const operators = operatorsFor(attribute);

  const attributeOptions: DropdownOption[] = attributes.map((entry) => ({
    value: entry.uuid,
    label: entry.unit ? `${entry.label} (${entry.unit})` : entry.label,
  }));

  const operatorOptions: DropdownOption[] = operators.map((operator) => ({
    value: operator,
    label: PREDICATE_OPERATOR_LABELS[operator],
  }));

  const changeAttribute = (uuid: string): void => {
    const next = attributes.find((entry) => entry.uuid === uuid);
    if (next) {
      onChange(defaultFor(next));
    }
  };

  const changeOperator = (operator: string): void => {
    const op = operator as PredicateOperator;
    if (op === "exists") {
      onChange({ op: "exists", attr: value.attr });
      return;
    }
    if (op === "between") {
      onChange({ op: "between", attr: value.attr, min: 0, max: 0 });
      return;
    }
    if (NUMERIC_OPS.includes(op)) {
      const current = "value" in value ? Number(value.value) : 0;
      onChange({
        op: op as "gt" | "gte" | "lt" | "lte",
        attr: value.attr,
        value: Number.isFinite(current) ? current : 0,
      });
      return;
    }
    if (op === "in" || op === "not_in") {
      const current =
        "values" in value
          ? value.values
          : "value" in value
            ? [value.value]
            : [];
      onChange(
        op === "in"
          ? { op: "in", attr: value.attr, values: current, mode: "any" }
          : { op: "not_in", attr: value.attr, values: current },
      );
      return;
    }
    const first = "values" in value ? value.values[0] : undefined;
    onChange({
      op: op === "equals" ? "equals" : "not_equals",
      attr: value.attr,
      value: first ?? (attribute?.type === "boolean" ? true : ""),
    });
  };

  const liveOptions = (attribute?.options ?? []).filter(
    (option) => !option.retired,
  );

  const setValues = (next: string[]): void => {
    if (!("values" in value)) {
      return;
    }
    onChange({ ...value, values: next });
  };

  return (
    <div className="flex flex-col gap-2 rounded-control border border-hairline bg-base p-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Dropdown
            value={value.attr}
            onChange={changeAttribute}
            options={attributeOptions}
          />
        </div>
        <div className="w-40 shrink-0">
          <Dropdown
            value={value.op}
            onChange={changeOperator}
            options={operatorOptions}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove this condition"
          className="shrink-0 rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400"
        >
          <X size={14} />
        </button>
      </div>

      {(value.op === "gt" ||
        value.op === "gte" ||
        value.op === "lt" ||
        value.op === "lte") && (
        <Input
          type="number"
          value={String(value.value)}
          onChange={(event) =>
            onChange({ ...value, value: Number(event.target.value) })
          }
          rightSlot={
            attribute?.unit ? (
              <span className="text-xs text-faint">{attribute.unit}</span>
            ) : undefined
          }
        />
      )}

      {value.op === "between" && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={String(value.min)}
            onChange={(event) =>
              onChange({ ...value, min: Number(event.target.value) })
            }
          />
          <span className="text-xs text-faint">and</span>
          <Input
            type="number"
            value={String(value.max)}
            onChange={(event) =>
              onChange({ ...value, max: Number(event.target.value) })
            }
          />
        </div>
      )}

      {attribute?.type === "boolean" &&
        (value.op === "equals" || value.op === "not_equals") && (
          <Dropdown
            value={value.value === true ? "true" : "false"}
            onChange={(next) => onChange({ ...value, value: next === "true" })}
            options={[
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ]}
          />
        )}

      {(value.op === "in" || value.op === "not_in") && (
        <div className="flex flex-col gap-2">
          {liveOptions.length === 0 ? (
            <span className="text-[11px] text-faint">
              This attribute has no options to pick.
            </span>
          ) : (
            <Dropdown
              multiple
              value={value.values.map(String)}
              onChange={setValues}
              options={liveOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              placeholder="Pick one or more values"
              searchable={liveOptions.length > 8}
            />
          )}

          {value.op === "in" && (
            <div className="w-full">
              <Dropdown
                value={value.mode}
                onChange={(next) =>
                  onChange({ ...value, mode: next as MatchMode })
                }
                options={Object.entries(MATCH_MODE_LABELS).map(
                  ([mode, label]) => ({ value: mode, label }),
                )}
              />
              <p className="mt-1 text-[11px] text-muted">
                On a product that has several of these values ticked, “any”
                matches when they overlap; “only these” matches when the product
                has nothing else.
              </p>
            </div>
          )}
        </div>
      )}

      {/* The two empty cases are opposites, so they cannot share a message: an
          empty "is" matches nothing, an empty "is not" excludes nothing. */}
      {value.op === "in" && value.values.length === 0 && (
        <p className="text-[11px] text-amber-500">
          Nothing selected — this condition can never match.
        </p>
      )}
      {value.op === "not_in" && value.values.length === 0 && (
        <p className="text-[11px] text-amber-500">
          Nothing excluded — this condition matches everything.
        </p>
      )}
    </div>
  );
};

export const PredicateEditor = ({
  value,
  onChange,
  attributes,
  emptyLabel = "Always — no condition",
  depth = 0,
}: PredicateEditorProps) => {
  const first = attributes[0];

  if (!value) {
    return (
      <div className="flex items-center justify-between rounded-control border border-dashed border-hairline px-3 py-2">
        <span className="text-xs text-faint">{emptyLabel}</span>
        <button
          type="button"
          disabled={!first}
          onClick={() => {
            if (first) {
              onChange(defaultFor(first));
            }
          }}
          className="flex items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover disabled:text-faint"
        >
          <Plus size={13} />
          Add condition
        </button>
      </div>
    );
  }

  if (isLeaf(value)) {
    return (
      <div className="flex flex-col gap-2">
        <LeafEditor
          value={value}
          onChange={onChange}
          onRemove={() => onChange(null)}
          attributes={attributes}
        />
        {depth === 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!first}
              onClick={() => {
                if (first) {
                  onChange({ op: "all", children: [value, defaultFor(first)] });
                }
              }}
              className="rounded-control px-2 py-1 text-xs text-primary hover:bg-hover disabled:text-faint"
            >
              + and…
            </button>
            <button
              type="button"
              disabled={!first}
              onClick={() => {
                if (first) {
                  onChange({ op: "any", children: [value, defaultFor(first)] });
                }
              }}
              className="rounded-control px-2 py-1 text-xs text-primary hover:bg-hover disabled:text-faint"
            >
              + or…
            </button>
          </div>
        )}
      </div>
    );
  }

  if (value.op === "not") {
    return (
      <div className="flex flex-col gap-2 rounded-control border border-hairline p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-secondary">NOT</span>
          <button
            type="button"
            onClick={() => onChange(value.child)}
            className="rounded-control px-2 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-ink"
          >
            remove NOT
          </button>
        </div>
        <PredicateEditor
          value={value.child}
          onChange={(next) =>
            onChange(next ? { op: "not", child: next } : null)
          }
          attributes={attributes}
          depth={depth + 1}
        />
      </div>
    );
  }

  if (!isGroup(value)) {
    return null;
  }

  const setChild = (index: number, next: Predicate | null): void => {
    const children = next
      ? value.children.map((child, at) => (at === index ? next : child))
      : value.children.filter((_, at) => at !== index);

    if (children.length === 0) {
      onChange(null);
      return;
    }
    // A group of one is just that one condition — collapsing it keeps the tree
    // readable instead of accumulating empty wrappers.
    const only = children[0];
    if (children.length === 1 && only) {
      onChange(only);
      return;
    }
    onChange({ ...value, children });
  };

  return (
    <div className="flex flex-col gap-2 rounded-control border border-hairline p-2">
      <div className="flex items-center gap-2">
        <div className="w-32">
          <Dropdown
            value={value.op}
            onChange={(next) =>
              onChange({ ...value, op: next === "any" ? "any" : "all" })
            }
            options={[
              { value: "all", label: "All of" },
              { value: "any", label: "Any of" },
            ]}
          />
        </div>
        <span className="text-[11px] text-faint">
          {value.op === "all"
            ? "every condition below must hold"
            : "at least one condition below must hold"}
        </span>
      </div>

      <div className="flex flex-col gap-2 pl-2">
        {value.children.map((child, index) => (
          <PredicateEditor
            key={index}
            value={child}
            onChange={(next) => setChild(index, next)}
            attributes={attributes}
            depth={depth + 1}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={!first}
        onClick={() => {
          if (first) {
            onChange({
              ...value,
              children: [...value.children, defaultFor(first)],
            });
          }
        }}
        className="flex w-fit items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover disabled:text-faint"
      >
        <Plus size={13} />
        Add condition
      </button>
    </div>
  );
};

/** A read-only one-line rendering of a condition, for list rows and previews. */
export const describePredicate = (
  predicate: Predicate | null,
  attributes: PredicateAttribute[],
): string => {
  if (!predicate) {
    return "always";
  }
  const label = (uuid: string): string =>
    attributes.find((entry) => entry.uuid === uuid)?.label ??
    "a deleted attribute";
  const optionLabel = (
    uuid: string,
    value: string | number | boolean,
  ): string => {
    const attribute = attributes.find((entry) => entry.uuid === uuid);
    const option = attribute?.options.find(
      (entry) => entry.value === String(value),
    );
    return option?.label ?? String(value);
  };

  if (predicate.op === "all" || predicate.op === "any") {
    const joiner = predicate.op === "all" ? " and " : " or ";
    return predicate.children
      .map((child) => describePredicate(child, attributes))
      .join(joiner);
  }
  if (predicate.op === "not") {
    return `not (${describePredicate(predicate.child, attributes)})`;
  }
  if (predicate.op === "exists") {
    return `${label(predicate.attr)} has any value`;
  }
  if (predicate.op === "between") {
    return `${label(predicate.attr)} is between ${predicate.min} and ${predicate.max}`;
  }
  if (predicate.op === "in" || predicate.op === "not_in") {
    const values = predicate.values
      .map((value) => optionLabel(predicate.attr, value))
      .join(", ");
    const verb = predicate.op === "in" ? "is" : "is not";
    return `${label(predicate.attr)} ${verb} ${values || "—"}`;
  }
  if (predicate.op === "equals" || predicate.op === "not_equals") {
    const rendered =
      typeof predicate.value === "boolean"
        ? predicate.value
          ? "Yes"
          : "No"
        : optionLabel(predicate.attr, predicate.value);
    return `${label(predicate.attr)} ${predicate.op === "equals" ? "is" : "is not"} ${rendered}`;
  }
  return `${label(predicate.attr)} ${PREDICATE_OPERATOR_LABELS[predicate.op]} ${predicate.value}`;
};
