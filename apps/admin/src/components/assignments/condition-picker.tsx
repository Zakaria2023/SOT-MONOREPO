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
  // The group column this choice is about, or null for the attribute itself.
  field: string | null;
  // The option value this choice asserts, or null for "has a value at all".
  value: string | null;
  label: string;
};

// A number has no list to pick from, so the one thing that can be said about it
// without an operator is that it was filled in.
const IS_SET = "__is_set__";

// Three parts, because a group's sentence is about one COLUMN of its rows and two
// columns of the same attribute must never collapse into one condition. A uuid and
// a sub-field key both exclude this separator, so splitting stays unambiguous.
const choiceId = (
  attrUuid: string,
  field: string | null,
  value: string | null,
): string => `${attrUuid}::${field ?? ""}::${value ?? IS_SET}`;

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
          id: choiceId(attribute.uuid, null, "true"),
          attrUuid: attribute.uuid,
          field: null,
          value: "true",
          label: `${attribute.label} is Yes`,
        },
        {
          id: choiceId(attribute.uuid, null, "false"),
          attrUuid: attribute.uuid,
          field: null,
          value: "false",
          label: `${attribute.label} is No`,
        },
      ];
    }

    if (attribute.type === "number") {
      return [
        {
          id: choiceId(attribute.uuid, null, null),
          attrUuid: attribute.uuid,
          field: null,
          value: null,
          label: `${attribute.label} is filled in`,
        },
      ];
    }

    // A GROUP holds rows, so nothing can be said about it as a whole — "Network
    // Ports is SFP" is not a sentence. Each PICK column becomes its own set of
    // sentences, read existentially: "any row's family is SFP".
    //
    // Count columns are deliberately absent. "24 ports" as a tick-box would mean
    // an exact total, which is almost never what an author means and is silent
    // when it is wrong; a threshold needs an operator this picker does not offer.
    if (attribute.type === "group") {
      return attribute.groupFields
        .filter((field) => field.kind === "select")
        .flatMap((field) =>
          field.options
            .filter((option) => !option.retired)
            .map((option) => ({
              id: choiceId(attribute.uuid, field.key, option.value),
              attrUuid: attribute.uuid,
              field: field.key,
              value: option.value,
              label: `${attribute.label} has any ${field.label} of ${option.label}`,
            })),
        );
    }

    return attribute.options
      .filter((option) => !option.retired)
      .map((option) => ({
        id: choiceId(attribute.uuid, null, option.value),
        attrUuid: attribute.uuid,
        field: null,
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
  // Keyed by attribute AND column. Two columns of one group are two separate
  // questions — "any SFP cage" and "any 10G cage" must stay two conditions, or
  // ticking both would ask whether one column holds both values and match nothing.
  const byTarget = new Map<string, Choice[]>();
  // Attribute order follows the attribute list, not click order, so re-picking
  // the same set always produces byte-identical stored JSON.
  for (const choice of choices) {
    if (!ids.includes(choice.id)) {
      continue;
    }
    const key = `${choice.attrUuid}::${choice.field ?? ""}`;
    const list = byTarget.get(key) ?? [];
    list.push(choice);
    byTarget.set(key, list);
  }

  const children: Predicate[] = [];
  for (const picked of byTarget.values()) {
    const first = picked[0];
    if (!first) {
      continue;
    }
    const attrUuid = first.attrUuid;
    const field = first.field;
    const attribute = attributes.find((entry) => entry.uuid === attrUuid);
    const values = picked
      .map((choice) => choice.value)
      .filter((value): value is string => value !== null);

    // Only set on a group's column, and omitted entirely otherwise — so a
    // condition on a plain attribute serialises byte-identically to one authored
    // before sub-field conditions existed.
    const on = field ? { field } : {};

    // "Is filled in", or a boolean with both answers ticked — which says nothing
    // beyond that it was answered.
    if (
      values.length === 0 ||
      (attribute?.type === "boolean" && values.length === 2)
    ) {
      children.push({ op: "exists", attr: attrUuid, ...on });
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

    children.push({ op: "in", attr: attrUuid, values, mode: "any", ...on });
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
    // A row filter narrows WHICH rows the sentence is about, and this picker has
    // no sentence for that. Decoding it as the unfiltered choice would look
    // right and then drop the filter the moment anything else was ticked —
    // quietly turning "has a 10G SFP port" into "has an SFP port" on a live rule.
    if ("where" in node && node.where) {
      return null;
    }
    if (node.op === "exists") {
      const attribute = attributes.find((entry) => entry.uuid === node.attr);
      // On a select, "has any value" is every option at once — there is no
      // single sentence for it, so it stays unrepresentable rather than being
      // quietly narrowed. Same for a group column.
      return attribute?.type === "number" && !node.field
        ? [choiceId(node.attr, null, null)]
        : null;
    }
    if (node.op === "equals") {
      return [choiceId(node.attr, node.field ?? null, String(node.value))];
    }
    if (node.op === "in" && node.mode === "any") {
      return node.values.map((value) =>
        choiceId(node.attr, node.field ?? null, String(value)),
      );
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

/**
 * A group's columns, described as attributes in their own right.
 *
 * The same trick the evaluator uses to run a row filter: a row is a small world
 * whose attributes are the columns. It means a filter is rendered and validated
 * by the SAME code as everything else, rather than by a second describer that
 * could word the same condition differently inside a row than outside one.
 */
export const rowAttributes = (
  attribute: PredicateAttribute,
): PredicateAttribute[] =>
  attribute.groupFields.map((field) => ({
    uuid: field.key,
    label: field.label,
    type: field.kind === "number" ? "number" : "single_select",
    ordered: field.kind === "select" ? field.ordered : false,
    unit: field.kind === "number" ? field.unit : null,
    options: field.kind === "select" ? field.options : [],
    groupFields: [],
  }));

/** "Speed is 10G and Family is SFP" — which rows a side or a condition counts. */
export const describeRowFilter = (
  where: Predicate,
  attribute: PredicateAttribute,
): string => describePredicate(where, rowAttributes(attribute));

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
  // Names the COLUMN as well when the condition is about one, because "Network
  // Ports is SFP" would hide which part of a row is being tested.
  const label = (uuid: string, field?: string): string => {
    const attribute = attributes.find((entry) => entry.uuid === uuid);
    if (!attribute) {
      return "a deleted attribute";
    }
    if (!field) {
      return attribute.label;
    }
    const subField = attribute.groupFields.find((entry) => entry.key === field);
    return `${attribute.label} · ${subField?.label ?? "a removed sub-field"}`;
  };

  // The row world for one attribute, or nothing when it holds no rows.
  const rowsOf = (uuid: string): PredicateAttribute[] => {
    const attribute = attributes.find((entry) => entry.uuid === uuid);
    return attribute ? rowAttributes(attribute) : [];
  };

  // " counting only rows where …". Always spelled out: a number that came from
  // some of the rows and a number that came from all of them look identical, and
  // the author is the only one who can tell them apart.
  const narrowing = (uuid: string, where: Predicate | undefined): string =>
    where
      ? `, counting only rows where ${describePredicate(where, rowsOf(uuid))}`
      : "";

  const optionLabel = (
    uuid: string,
    value: string | number | boolean,
    field?: string,
  ): string => {
    const attribute = attributes.find((entry) => entry.uuid === uuid);
    // A sub-field's options, not the attribute's — a group has no master list, so
    // looking there would always miss and fall back to the raw stored value.
    const options = field
      ? attribute?.groupFields.find((entry) => entry.key === field)?.options
      : attribute?.options;
    const option = options?.find((entry) => entry.value === String(value));
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
  if (predicate.op === "in_category") {
    const group = categoryOptions.find(
      (option) => option.value === predicate.categoryUuid,
    );
    return group ? `in ${group.label.trim()}` : "in a product group";
  }

  const on = predicate.field;
  const only = narrowing(predicate.attr, predicate.where);
  if (predicate.op === "exists") {
    if (!on) {
      return `${label(predicate.attr)} is filled in`;
    }
    // With a filter this is the useful reading and the one the evaluator takes:
    // is there a row LIKE THAT at all.
    return predicate.where
      ? `${label(predicate.attr)} has a row where ${describePredicate(predicate.where, rowsOf(predicate.attr))}`
      : `${label(predicate.attr, on)} is filled in on at least one row`;
  }
  if (predicate.op === "between") {
    return `${label(predicate.attr, on)} is between ${predicate.min} and ${predicate.max}${only}`;
  }
  if (predicate.op === "in" || predicate.op === "not_in") {
    const values = predicate.values
      .map((value) => optionLabel(predicate.attr, value, on))
      .join(" or ");
    // A group column is read across rows, so the verb has to say so — "includes"
    // rather than "is", or the sentence reads as though one row were being tested.
    const verb = on
      ? predicate.op === "in"
        ? "includes"
        : "does not include"
      : predicate.op === "in"
        ? "is"
        : "is not";
    return `${label(predicate.attr, on)} ${verb} ${values || "—"}${only}`;
  }
  if (predicate.op === "equals" || predicate.op === "not_equals") {
    const rendered =
      typeof predicate.value === "boolean"
        ? predicate.value
          ? "Yes"
          : "No"
        : optionLabel(predicate.attr, predicate.value, on);
    // On a column, `equals` means the picks are EXACTLY this one — "only SFP",
    // not "has an SFP". The distinction is the whole difference between the two
    // operators and has to survive into the sentence.
    if (on) {
      return `${label(predicate.attr, on)} ${predicate.op === "equals" ? "is only" : "is not only"} ${rendered}${only}`;
    }
    return `${label(predicate.attr)} ${predicate.op === "equals" ? "is" : "is not"} ${rendered}`;
  }
  const comparator = {
    gt: "is more than",
    gte: "is at least",
    lt: "is less than",
    lte: "is at most",
  }[predicate.op];
  return `${label(predicate.attr, on)} ${comparator} ${predicate.value}${only}`;
};
