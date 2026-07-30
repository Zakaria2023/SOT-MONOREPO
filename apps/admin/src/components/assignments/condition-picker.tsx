"use client";

import type { SpecificationType } from "@/db/enum";
import type { Predicate, SpecGroupField, SpecOption } from "@/db/types";
import { Dropdown } from "ui";

// ---------------------------------------------------------------------------
// THE condition picker. One component, used everywhere a condition is authored:
//
//   - the conditional reveal on an assignment ("show PoE Budget when PoE = Yes")
//   - which items count as consumers on a rule
//   - which items count as providers on a rule
//   - a row of a conditional rule's lookup table
//   - a presence trigger, and each way a requirement can be satisfied
//
// One picker because there is one condition language. Five editors is how the
// same "if PoE = Yes" ends up expressible five ways and answering differently in
// each.
//
// It is a MULTI-SELECT OF FINISHED SENTENCES, not a builder. Every choice is a
// condition somebody could already have authored — "PoE is Yes", "Device Role is
// Camera" — assembled from the attributes in scope and the values they actually
// offer. There is no operator to pick, no AND/OR to nest, and no way to write a
// condition that can never match.
//
// The two words it does not make you say:
//
//   OR is implied WITHIN an attribute. Picking af and at means "af or at",
//   because one product's PoE Type cannot be both.
//   AND is implied ACROSS attributes. Picking "PoE is Yes" and "Role is Switch"
//   means both, because they are separate questions.
//
// That is the only reading of a set of values that is ever correct, so making an
// author choose it was asking a question with one right answer.
// ---------------------------------------------------------------------------

// The attribute list the picker draws from. Structural, so both the assignment
// tab (which passes what one category carries) and the relation builder (which
// passes the whole library) can hand it what they already have loaded.
export type PredicateAttribute = {
  uuid: string;
  label: string;
  type: SpecificationType;
  ordered: boolean;
  unit: string | null;
  options: SpecOption[];
  // Only on `group`. The rule builder offers each numeric sub-field as its own
  // operand, because a group has no single number to compare.
  groupFields: SpecGroupField[];
  // The library group it is filed under, for narrowing a long picker. Filing
  // only, and never read here — a condition means the same thing whichever
  // drawer the attribute was found in. Absent on attributes resolved from a
  // category, which are already narrowed to that category.
  groupName?: string | null;
};

type ConditionPickerProps = {
  value: Predicate | null;
  onChange: (next: Predicate | null) => void;
  attributes: PredicateAttribute[];
  // Wording for the empty state, since "always shown" and "everything
  // participates" are the same condition read two different ways.
  emptyLabel?: string;
};

// One pickable sentence.
type Choice = {
  id: string;
  attrUuid: string;
  // The option value this choice asserts, or null for "has a value at all".
  value: string | null;
  label: string;
};

// A number has no list to pick from, so the one thing that can be said about it
// without an operator is that it was filled in.
const IS_SET = "__is_set__";

const choiceId = (attrUuid: string, value: string | null): string =>
  `${attrUuid}::${value ?? IS_SET}`;

/**
 * Every condition that can be said about the attributes in scope.
 *
 * Retired options are left out: a condition naming a value no longer offered
 * would sit there matching nothing, with nothing to say why.
 */
const buildChoices = (attributes: PredicateAttribute[]): Choice[] =>
  attributes.flatMap((attribute): Choice[] => {
    if (attribute.type === "boolean") {
      return [
        {
          id: choiceId(attribute.uuid, "true"),
          attrUuid: attribute.uuid,
          value: "true",
          label: `${attribute.label} is Yes`,
        },
        {
          id: choiceId(attribute.uuid, "false"),
          attrUuid: attribute.uuid,
          value: "false",
          label: `${attribute.label} is No`,
        },
      ];
    }

    if (attribute.type === "number") {
      return [
        {
          id: choiceId(attribute.uuid, null),
          attrUuid: attribute.uuid,
          value: null,
          label: `${attribute.label} is filled in`,
        },
      ];
    }

    return attribute.options
      .filter((option) => !option.retired)
      .map((option) => ({
        id: choiceId(attribute.uuid, option.value),
        attrUuid: attribute.uuid,
        value: option.value,
        label: `${attribute.label} is ${option.label}`,
      }));
  });

/**
 * The picked sentences, as a stored condition.
 *
 * Values of the SAME attribute collapse into one `in` — which is exactly the
 * shape already stored, so nothing authored before this picker existed has to be
 * rewritten to be readable by it.
 */
const encode = (
  ids: string[],
  attributes: PredicateAttribute[],
  choices: Choice[],
): Predicate | null => {
  const byAttribute = new Map<string, Choice[]>();
  // Attribute order follows the attribute list, not click order, so re-picking
  // the same set always produces byte-identical stored JSON.
  for (const choice of choices) {
    if (!ids.includes(choice.id)) {
      continue;
    }
    const list = byAttribute.get(choice.attrUuid) ?? [];
    list.push(choice);
    byAttribute.set(choice.attrUuid, list);
  }

  const children: Predicate[] = [];
  for (const [attrUuid, picked] of byAttribute) {
    const attribute = attributes.find((entry) => entry.uuid === attrUuid);
    const values = picked
      .map((choice) => choice.value)
      .filter((value): value is string => value !== null);

    // "Is filled in", or a boolean with both answers ticked — which says nothing
    // beyond that it was answered.
    if (
      values.length === 0 ||
      (attribute?.type === "boolean" && values.length === 2)
    ) {
      children.push({ op: "exists", attr: attrUuid });
      continue;
    }

    if (attribute?.type === "boolean") {
      children.push({
        op: "equals",
        attr: attrUuid,
        value: values[0] === "true",
      });
      continue;
    }

    children.push({ op: "in", attr: attrUuid, values, mode: "any" });
  }

  const only = children[0];
  if (!only) {
    return null;
  }
  return children.length === 1 ? only : { op: "all", children };
};

/**
 * A stored condition, as picked sentences — or null when it says something this
 * picker cannot.
 *
 * Null is not a failure to be papered over. A rule authored before this picker,
 * or through the API, may hold a comparison the picker has no sentence for; the
 * honest thing is to SHOW it and leave it alone rather than silently rewrite a
 * live rule into something that means less.
 */
const decode = (
  predicate: Predicate | null,
  attributes: PredicateAttribute[],
): string[] | null => {
  if (!predicate) {
    return [];
  }

  const one = (node: Predicate): string[] | null => {
    if (node.op === "exists") {
      const attribute = attributes.find((entry) => entry.uuid === node.attr);
      // On a select, "has any value" is every option at once — there is no
      // single sentence for it, so it stays unrepresentable rather than being
      // quietly narrowed.
      return attribute?.type === "number" ? [choiceId(node.attr, null)] : null;
    }
    if (node.op === "equals") {
      return [
        choiceId(
          node.attr,
          typeof node.value === "boolean"
            ? String(node.value)
            : String(node.value),
        ),
      ];
    }
    if (node.op === "in" && node.mode === "any") {
      return node.values.map((value) => choiceId(node.attr, String(value)));
    }
    return null;
  };

  if (predicate.op === "all") {
    const decoded: string[] = [];
    for (const child of predicate.children) {
      const ids = one(child);
      if (!ids) {
        return null;
      }
      decoded.push(...ids);
    }
    return decoded;
  }

  return one(predicate);
};

export const ConditionPicker = ({
  value,
  onChange,
  attributes,
  emptyLabel = "Always — no condition",
}: ConditionPickerProps) => {
  const choices = buildChoices(attributes);
  const picked = decode(value, attributes);

  // Something authored elsewhere that has no sentence here. Shown as it reads,
  // with one deliberate way out — never edited by halves.
  if (picked === null) {
    return (
      <div className="flex flex-col gap-2 rounded-control border border-hairline bg-base px-3 py-2.5">
        <p className="text-xs text-secondary">
          {describePredicate(value, attributes)}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted">
            This condition is more specific than the picker can show. It keeps
            working exactly as it is.
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 rounded-control px-2 py-1 text-[11px] text-primary hover:bg-hover"
          >
            Replace it
          </button>
        </div>
      </div>
    );
  }

  // Only the ids that still exist. An option retired since it was picked drops
  // out here rather than being re-saved into a condition that cannot match.
  const live = picked.filter((id) =>
    choices.some((choice) => choice.id === id),
  );

  return (
    <Dropdown
      multiple
      value={live}
      onChange={(next) => onChange(encode(next, attributes, choices))}
      options={choices.map((choice) => ({
        value: choice.id,
        label: choice.label,
      }))}
      placeholder={emptyLabel}
      searchable={choices.length > 8}
      emptyMessage="Nothing here can be used as a condition yet."
    />
  );
};

/** A read-only one-line rendering of a condition, for list rows and previews. */
export const describePredicate = (
  predicate: Predicate | null,
  attributes: PredicateAttribute[],
  // The tree, when the caller has it. Without it a group can only be described
  // as "a product group" — which is true but useless in a list of rules.
  categoryOptions: { value: string; label: string }[] = [],
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
      .map((child) => describePredicate(child, attributes, categoryOptions))
      .join(joiner);
  }
  if (predicate.op === "not") {
    return `not (${describePredicate(predicate.child, attributes, categoryOptions)})`;
  }
  if (predicate.op === "exists") {
    return `${label(predicate.attr)} is filled in`;
  }
  if (predicate.op === "in_category") {
    const group = categoryOptions.find(
      (option) => option.value === predicate.categoryUuid,
    );
    return group ? `in ${group.label.trim()}` : "in a product group";
  }
  if (predicate.op === "between") {
    return `${label(predicate.attr)} is between ${predicate.min} and ${predicate.max}`;
  }
  if (predicate.op === "in" || predicate.op === "not_in") {
    const values = predicate.values
      .map((value) => optionLabel(predicate.attr, value))
      .join(" or ");
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
  const comparator = {
    gt: "is more than",
    gte: "is at least",
    lt: "is less than",
    lte: "is at most",
  }[predicate.op];
  return `${label(predicate.attr)} ${comparator} ${predicate.value}`;
};
