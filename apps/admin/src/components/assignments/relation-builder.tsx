"use client";

import {
  addRelationAction,
  deleteRelationAction,
  updateRelationAction,
  validateRelationAction,
  type RelationshipInput,
  type RelationshipProblem,
} from "@/app/(dashboard)/assignments/actions";
import { RelationPreview } from "@/components/assignments/relation-preview";
import { RowFilter } from "@/components/assignments/row-filter";
import { Field } from "@/components/shared/field";
import { PresenceEditor } from "@/components/assignments/presence-editor";
import {
  ConditionPicker,
  describePredicate,
  describeRowFilter,
  type PredicateAttribute,
} from "@/components/assignments/condition-picker";
import {
  LookupEditor,
  LookupLimit,
} from "@/components/assignments/lookup-editor";
import type {
  ProjectVariableType,
  RelationshipComparator,
  RelationshipFamily,
} from "@/db/enum";
import { relationshipFamilies, relationshipGates } from "@/db/enum";
import {
  RELATIONSHIP_COMPARATOR_LABELS,
  RELATIONSHIP_FAMILY_HINTS,
  RELATIONSHIP_FAMILY_LABELS,
  RELATIONSHIP_GATE_LABELS,
  RELATIONSHIP_STATUS_LABELS,
} from "@/db/label";
import type { LookupTable, Operand, Predicate, PresenceSpec } from "@/db/types";
import {
  Check,
  FlaskConical,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { SelectRelationships } from "@/db/schema/relationships";
import { Button, Dropdown, Input, type DropdownOption } from "ui";

export type RelationVariable = {
  uuid: string;
  label: string;
  unit: string | null;
  // The preview asks the author to answer these, and a yes/no question needs a
  // yes/no control rather than a number box.
  type: ProjectVariableType;
};

type RelationBuilderProps = {
  relationships: SelectRelationships[];
  attributes: PredicateAttribute[];
  variables: RelationVariable[];
  // The whole category tree, depth-ordered — what a "product group" picks from.
  // Never narrowed to the category selected in the sidebar: a rule is global,
  // and its whole job is to relate one part of the tree to another.
  categoryOptions: DropdownOption[];
};

type RelationFormProps = {
  initial?: SelectRelationships;
  attributes: PredicateAttribute[];
  variables: RelationVariable[];
  categoryOptions: DropdownOption[];
  onSubmit: (input: RelationshipInput) => void;
  onCancel: () => void;
  pending: boolean;
  error?: string;
};

const FAMILY_OPTIONS: DropdownOption[] = relationshipFamilies.map((family) => ({
  value: family,
  label: RELATIONSHIP_FAMILY_LABELS[family],
}));

// Attributes filed under no group still need a bucket to be filtered by.
const UNGROUPED = "Ungrouped";

// The Count family's consumer, as a single picker value. `item_count` alone
// counts everything, so the useful question is WHICH items — which is a product
// group — or, when the number comes from the buyer, a project variable.
const COUNT_EVERYTHING = "__everything__";

const countedSource = (form: RelationshipInput): string => {
  if (form.consumer?.source === "variable") {
    return form.consumer.variableUuid;
  }
  if (form.consumerWhen?.op === "in_category") {
    return form.consumerWhen.categoryUuid;
  }
  return COUNT_EVERYTHING;
};

/**
 * Turn the picked source into the two fields it actually sets.
 *
 * A product group is not an operand — it is a FILTER over item_count, which is
 * why this writes `consumerWhen` and not `consumer`. Keeping that in one place
 * is what stops the two fields drifting into disagreeing about what is counted.
 */
const countedPatch = (
  uuid: string,
  variables: RelationVariable[],
): Partial<RelationshipInput> => {
  if (variables.some((variable) => variable.uuid === uuid)) {
    return {
      consumer: { source: "variable", variableUuid: uuid },
      consumerWhen: null,
    };
  }
  if (uuid === COUNT_EVERYTHING) {
    return { consumer: { source: "item_count" }, consumerWhen: null };
  }
  return {
    consumer: { source: "item_count" },
    consumerWhen: { op: "in_category", categoryUuid: uuid },
  };
};

// A group's sub-field is picked as one dropdown value, so the picker stays a flat
// list rather than growing a second control that is meaningless for every other
// attribute. A uuid cannot contain this character, so splitting is unambiguous.
const FIELD_SEPARATOR = "::";

/** What a side points at, or "" when it points at neither an attribute nor an
 * input — item_count and a constant have no uuid to show in a picker. */
const operandUuid = (operand: Operand | null): string => {
  if (operand?.source === "spec") {
    return operand.groupField
      ? `${operand.specUuid}${FIELD_SEPARATOR}${operand.groupField}`
      : operand.specUuid;
  }
  if (operand?.source === "variable") {
    return operand.variableUuid;
  }
  return "";
};

// Which comparators a family can actually use. Offering "must overlap" on a
// budget would produce a rule that cannot be evaluated.
const comparatorsFor = (
  family: RelationshipFamily,
): RelationshipComparator[] => {
  if (family === "match") {
    // "within" is the only one that reads a span, which is what a voltage or a
    // frequency window actually is — a PSU supplying 48 V against a device
    // accepting 36–57 V needs both ends, and a lone ceiling passes 12 V in silence.
    //
    // "below"/"above" are the strict pair, and they exist for the notice rather
    // than the gate: a 1G module seats fine in a 10G cage, and the thing worth
    // telling the buyer is that the link then runs at 1G. "at most" would say it
    // about a correctly matched pair too.
    return ["in", "intersects", "eq", "lte", "gte", "lt", "gt", "within"];
  }
  if (family === "budget" || family === "count" || family === "conditional") {
    return ["lte", "gte", "eq"];
  }
  return ["lte"];
};

const emptyInput = (): RelationshipInput => ({
  name: "",
  description: null,
  family: "budget",
  gate: "block",
  comparator: "lte",
  matchMode: "any",
  headroomPercent: 100,
  ratioLimit: null,
  allocation: "per_unit",
  perItem: false,
  consumer: null,
  provider: null,
  consumerWhen: null,
  providerWhen: null,
  lookup: null,
  presence: null,
  scope: null,
});

const toInput = (row: SelectRelationships): RelationshipInput => ({
  name: row.name,
  description: row.description,
  family: row.family,
  gate: row.gate,
  comparator: row.comparator,
  matchMode: row.matchMode,
  headroomPercent: row.headroomPercent,
  ratioLimit: row.ratioLimit === null ? null : Number(row.ratioLimit),
  allocation: row.allocation,
  perItem: row.perItem,
  consumer: row.consumer ?? null,
  provider: row.provider ?? null,
  consumerWhen: row.consumerWhen ?? null,
  providerWhen: row.providerWhen ?? null,
  lookup: row.lookup ?? null,
  presence: row.presence ?? null,
  scope: row.scope ?? null,
});

const RelationForm = ({
  initial,
  attributes,
  variables,
  categoryOptions,
  onSubmit,
  onCancel,
  pending,
  error,
}: RelationFormProps) => {
  const [form, setForm] = useState<RelationshipInput>(
    initial ? toInput(initial) : emptyInput(),
  );
  const [problems, setProblems] = useState<RelationshipProblem[]>([]);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);

  // Every group in the LIBRARY. Not the selected category's — a rule is global,
  // and the whole point of one is comparing a camera's attribute against a
  // switch's, which no single category carries both of.
  const groupOptions = useMemo<DropdownOption[]>(() => {
    const names = new Set<string>();
    for (const attribute of attributes) {
      names.add(attribute.groupName ?? UNGROUPED);
    }
    return [...names].sort().map((name) => ({ value: name, label: name }));
  }, [attributes]);

  // One list per side, not a source picker and then a list. Project inputs sit
  // in the same dropdown as attributes because from the rule's point of view
  // they are the same thing — a number to compare. There are none today, so this
  // reads as a plain attribute list; it stays correct the day somebody adds one.
  const sideOptions = useMemo<DropdownOption[]>(
    () => [
      ...attributes
        .filter(
          (attribute) =>
            groups.length === 0 ||
            groups.includes(attribute.groupName ?? UNGROUPED),
        )
        // A group is not offered as itself. It holds rows, so it has no single
        // number to compare — each COUNT inside it is offered instead, which is
        // what the rule actually totals. Offering the attribute alone would let an
        // author build a rule that silently reads nothing.
        .flatMap((attribute) =>
          attribute.type === "group"
            ? attribute.groupFields
                .filter((field) => field.kind === "number")
                .map((field) => ({
                  value: `${attribute.uuid}${FIELD_SEPARATOR}${field.key}`,
                  label: field.unit
                    ? `${attribute.label} · ${field.label} (${field.unit}, totalled)`
                    : `${attribute.label} · ${field.label} (totalled)`,
                }))
            : [
                {
                  value: attribute.uuid,
                  label: attribute.unit
                    ? `${attribute.label} (${attribute.unit})`
                    : attribute.label,
                },
              ],
        ),
      ...variables.map((variable) => ({
        value: variable.uuid,
        label: variable.unit
          ? `${variable.label} (${variable.unit}) — the buyer tells us`
          : `${variable.label} — the buyer tells us`,
      })),
    ],
    [attributes, groups, variables],
  );

  // Groups that offer nothing to total, so the picker above can say why they are
  // missing instead of simply omitting them.
  const uncountableGroups = useMemo<string[]>(
    () =>
      attributes
        .filter(
          (attribute) =>
            attribute.type === "group" &&
            (groups.length === 0 ||
              groups.includes(attribute.groupName ?? UNGROUPED)) &&
            !attribute.groupFields.some((field) => field.kind === "number"),
        )
        .map((attribute) => `"${attribute.label}"`),
    [attributes, groups],
  );

  // Which kind of operand a picked value is. Variables are few and attributes
  // many, so asking the short list is the cheap question.
  const toOperand = (picked: string): Operand => {
    const [specUuid, groupField] = picked.split(FIELD_SEPARATOR);
    if (specUuid && groupField) {
      return { source: "spec", specUuid, groupField };
    }
    return variables.some((variable) => variable.uuid === picked)
      ? { source: "variable", variableUuid: picked }
      : { source: "spec", specUuid: picked };
  };

  // Any edit invalidates the last verdict — a stale "nothing wrong" beside a
  // rule that has since changed is worse than no verdict at all.
  const patch = (next: Partial<RelationshipInput>): void => {
    setProblems([]);
    setChecked(false);
    setForm((current) => ({ ...current, ...next }));
  };

  const validate = async (
    candidate: RelationshipInput,
  ): Promise<RelationshipProblem[]> => {
    setChecking(true);
    try {
      const found = await validateRelationAction(candidate);
      setProblems(found);
      setChecked(true);
      return found;
    } finally {
      setChecking(false);
    }
  };

  const check = (): void => {
    void validate(form);
  };

  // Saving validates FIRST so the author sees every problem at once. The service
  // validates again and throws — but only ever the first problem, which is the
  // whack-a-mole this list exists to avoid.
  const submit = (): void => {
    void validate(form).then((found) => {
      if (found.length === 0) {
        onSubmit(form);
      }
    });
  };

  const changeFamily = (family: RelationshipFamily): void => {
    const comparators = comparatorsFor(family);
    patch({
      family,
      comparator: comparators.includes(form.comparator)
        ? form.comparator
        : (comparators[0] ?? "lte"),
      // Presence and conditional have no provider side; ratio warns by default
      // because a contention ratio is a design judgement, not a hard limit.
      provider:
        family === "presence" || family === "conditional"
          ? null
          : form.provider,
      gate: family === "ratio" ? "warn" : form.gate,
      presence:
        family === "presence"
          ? (form.presence ?? {
              trigger: { op: "in_category", categoryUuid: "" },
              requires: [],
              suggestedFix: null,
            })
          : null,
      lookup:
        family === "conditional"
          ? (form.lookup ?? { inputs: [], rows: [] })
          : null,
      consumer: family === "count" ? { source: "item_count" } : form.consumer,
    });
  };

  const comparatorOptions: DropdownOption[] = comparatorsFor(form.family).map(
    (comparator) => ({
      value: comparator,
      label: RELATIONSHIP_COMPARATOR_LABELS[comparator],
    }),
  );

  const countedOptions: DropdownOption[] = [
    { value: COUNT_EVERYTHING, label: "Every item in the basket" },
    ...categoryOptions,
    ...variables.map((variable) => ({
      value: variable.uuid,
      label: `${variable.label} — the buyer tells us`,
    })),
  ];

  // The rule in one line, derived from the form. A hand-written summary drifts
  // from what is stored the first time somebody edits one and not the other.
  const label = (uuid: string): string =>
    attributes.find((entry) => entry.uuid === uuid)?.label ??
    variables.find((entry) => entry.uuid === uuid)?.label ??
    "…";
  const groupLabel = (uuid: string): string =>
    categoryOptions.find((option) => option.value === uuid)?.label.trim() ??
    "…";
  const a = label(operandUuid(form.consumer));
  const b = label(operandUuid(form.provider));

  const shorthand = ((): string => {
    if (form.family === "budget") {
      const headroom =
        form.headroomPercent === 100 ? "" : ` × ${form.headroomPercent}%`;
      return `Σ("${a}" × qty) ≤ "${b}"${headroom}`;
    }
    if (form.family === "count") {
      const source = countedSource(form);
      const counted =
        source === COUNT_EVERYTHING
          ? "items"
          : variables.some((variable) => variable.uuid === source)
            ? label(source)
            : groupLabel(source);
      return `${counted} ≤ Σ("${b}" × qty)`;
    }
    if (form.family === "match") {
      // The FILTERS belong in the summary, not just in the form. The port model
      // is three rules that differ only by their family guard, and without this
      // all three read as one identical sentence in the list.
      const side = (predicate: Predicate | null): string =>
        predicate
          ? ` (${describePredicate(predicate, attributes, categoryOptions)})`
          : "";
      return `"${a}"${side(form.consumerWhen)} ${RELATIONSHIP_COMPARATOR_LABELS[form.comparator]} "${b}"${side(form.providerWhen)}`;
    }
    if (form.family === "ratio") {
      return `"${a}" ÷ "${b}" ≤ ${form.ratioLimit ?? "…"}:1`;
    }
    if (form.family === "presence") {
      const describe = (predicate: Predicate | null): string => {
        if (predicate?.op === "in_category") {
          return groupLabel(predicate.categoryUuid);
        }
        if (predicate && "attr" in predicate) {
          return label(predicate.attr);
        }
        return "…";
      };
      const trigger = describe(form.presence?.trigger ?? null);
      const requires = form.presence?.requires[0]?.satisfiedBy[0];
      const needed =
        requires?.type === "item_exists" ? describe(requires.predicate) : "…";
      return `if [${trigger}] ⇒ [${needed}] present`;
    }
    const rows = form.lookup?.rows ?? [];
    const first = rows[0];
    return `if … then "${a}" ≤ ${first ? first.limit : "…"}`;
  })();

  return (
    <div className="flex flex-col gap-4 rounded-card border border-primary/40 bg-surface p-4">
      <Input
        label="Name"
        placeholder="Switch PoE budget covers device draw"
        value={form.name}
        onChange={(event) => patch({ name: event.target.value })}
      />

      <Field label="Family" hint={RELATIONSHIP_FAMILY_HINTS[form.family]}>
        <Dropdown
          value={form.family}
          onChange={(next) => changeFamily(next as RelationshipFamily)}
          options={FAMILY_OPTIONS}
        />
      </Field>

      {/* Two states, so two buttons. A dropdown to choose between "blocks" and
          "warns" hides the more consequential of the two behind a click. */}
      <Field label="Gate">
        <div className="flex w-fit rounded-control border border-hairline p-0.5">
          {relationshipGates.map((gate) => (
            <button
              key={gate}
              type="button"
              onClick={() => patch({ gate })}
              className={`rounded px-4 py-1.5 text-sm ${
                form.gate === gate
                  ? gate === "block"
                    ? "bg-red-500/15 font-medium text-red-400"
                    : "bg-amber-500/15 font-medium text-amber-500"
                  : "text-muted hover:text-ink"
              }`}
            >
              {RELATIONSHIP_GATE_LABELS[gate]}
            </button>
          ))}
        </div>
      </Field>

      {/* A filter on the two pickers below, never saved. Deliberately drawn from
          the WHOLE library and not from the category selected in the tree: a
          rule is global, and the whole point of it is to compare a camera's
          attribute against a switch's. */}
      {groupOptions.length > 1 && form.family !== "presence" && (
        <Field label="Groups">
          <Dropdown
            multiple
            value={groups}
            onChange={setGroups}
            options={groupOptions}
            placeholder={`All ${groupOptions.length} groups`}
            searchable={groupOptions.length > 8}
          />
        </Field>
      )}

      {/* A group with no count sub-field cannot be totalled, so it is absent from
          every side picker below. Said here rather than left as a gap: an author
          hunting for "Network Ports" and not finding it has no way to guess that
          the reason is a missing count column. */}
      {uncountableGroups.length > 0 && (
        <p className="text-[11px] text-muted">
          {uncountableGroups.join(", ")} hold rows but no count, so there is
          nothing to add up and they are not listed below. Add a count sub-field
          in the library to use one in a rule.
        </p>
      )}

      {form.family === "presence" && (
        <PresenceEditor
          value={
            form.presence ?? {
              trigger: { op: "in_category", categoryUuid: "" },
              requires: [],
              suggestedFix: null,
            }
          }
          onChange={(presence: PresenceSpec) => patch({ presence })}
          attributes={attributes}
          categoryOptions={categoryOptions}
        />
      )}

      {/* BUDGET — capacity first, because the sentence is "capacity covers
          draw" and reading it in the other order inverts the rule. */}
      {form.family === "budget" && (
        <>
          <Field label="Capacity attribute">
            <Dropdown
              value={operandUuid(form.provider)}
              onChange={(uuid) => patch({ provider: toOperand(uuid) })}
              options={sideOptions}
              searchable
              placeholder="— attribute —"
            />
          </Field>
          <RowFilter
            operand={form.provider}
            attributes={attributes}
            onChange={(next) => patch({ provider: next })}
          />
          <Field label="Consumer attribute (summed × qty)">
            <Dropdown
              value={operandUuid(form.consumer)}
              onChange={(uuid) => patch({ consumer: toOperand(uuid) })}
              options={sideOptions}
              searchable
              placeholder="— attribute —"
            />
          </Field>
          <RowFilter
            operand={form.consumer}
            attributes={attributes}
            onChange={(next) => patch({ consumer: next })}
          />
          <Input
            label="Headroom %"
            type="number"
            min={1}
            max={100}
            value={String(form.headroomPercent)}
            onChange={(event) =>
              patch({ headroomPercent: Number(event.target.value) })
            }
          />
        </>
      )}

      {/* COUNT — the limit is an attribute on the container; what gets counted
          is a group of products, not a value they carry. */}
      {form.family === "count" && (
        <>
          <Field label="Limit attribute (summed × qty across containers)">
            <Dropdown
              value={operandUuid(form.provider)}
              onChange={(uuid) => patch({ provider: toOperand(uuid) })}
              options={sideOptions}
              searchable
              placeholder="— attribute —"
            />
          </Field>
          <RowFilter
            operand={form.provider}
            attributes={attributes}
            onChange={(next) => patch({ provider: next })}
          />
          <Field label="Counted source — a product group or a project variable">
            <Dropdown
              value={countedSource(form)}
              onChange={(next) => patch(countedPatch(next, variables))}
              options={countedOptions}
              searchable
              placeholder="— source —"
            />
          </Field>
        </>
      )}

      {/* MATCH — two values and how they have to relate. No arithmetic. */}
      {form.family === "match" && (
        <>
          <Field label="Attribute A">
            <Dropdown
              value={operandUuid(form.consumer)}
              onChange={(uuid) => patch({ consumer: toOperand(uuid) })}
              options={sideOptions}
              searchable
              placeholder="— attribute —"
            />
          </Field>
          <RowFilter
            operand={form.consumer}
            attributes={attributes}
            onChange={(next) => patch({ consumer: next })}
          />
          {/* WHICH items count as side A, beyond simply carrying the attribute.
              The engine has always applied these; nothing could author them, so
              every match rule compared every item that held the value against
              every item that held the other. That is unanswerable for a physical
              fit: an SFP module and a QSFP cage both carry a speed, and without a
              family guard the rule cheerfully compares them. */}
          <Field
            label="Side A is limited to"
            hint="Leave empty and every item carrying the attribute takes part."
          >
            <ConditionPicker
              value={form.consumerWhen}
              onChange={(consumerWhen) => patch({ consumerWhen })}
              attributes={attributes}
              emptyLabel="Anything carrying attribute A"
            />
          </Field>
          <Field label="Compatible via">
            <Dropdown
              value={form.comparator}
              onChange={(next) =>
                patch({ comparator: next as RelationshipComparator })
              }
              options={comparatorOptions}
            />
          </Field>
          <Field label="Attribute B">
            <Dropdown
              value={operandUuid(form.provider)}
              onChange={(uuid) => patch({ provider: toOperand(uuid) })}
              options={sideOptions}
              searchable
              placeholder="— attribute —"
            />
          </Field>
          <RowFilter
            operand={form.provider}
            attributes={attributes}
            onChange={(next) => patch({ provider: next })}
          />
          <Field
            label="Side B is limited to"
            hint="The pair of these two is what expresses a family guard — SFP against SFP, never SFP against QSFP."
          >
            <ConditionPicker
              value={form.providerWhen}
              onChange={(providerWhen) => patch({ providerWhen })}
              attributes={attributes}
              emptyLabel="Anything carrying attribute B"
            />
          </Field>
        </>
      )}

      {/* RATIO — either side may be something the buyer told us, which is the
          only reason project variables exist at all. */}
      {form.family === "ratio" && (
        <>
          <Field label="Demand — attribute or project variable">
            <Dropdown
              value={operandUuid(form.consumer)}
              onChange={(uuid) => patch({ consumer: toOperand(uuid) })}
              options={sideOptions}
              searchable
              placeholder="— source —"
            />
          </Field>
          <RowFilter
            operand={form.consumer}
            attributes={attributes}
            onChange={(next) => patch({ consumer: next })}
          />
          <Field label="Supply — attribute or project variable">
            <Dropdown
              value={operandUuid(form.provider)}
              onChange={(uuid) => patch({ provider: toOperand(uuid) })}
              options={sideOptions}
              searchable
              placeholder="— source —"
            />
          </Field>
          <RowFilter
            operand={form.provider}
            attributes={attributes}
            onChange={(next) => patch({ provider: next })}
          />
          <Input
            label="Target ratio (n : 1)"
            type="number"
            value={form.ratioLimit === null ? "" : String(form.ratioLimit)}
            onChange={(event) =>
              patch({
                ratioLimit:
                  event.target.value === "" ? null : Number(event.target.value),
              })
            }
          />
        </>
      )}

      {/* CONDITIONAL — the key is the item's own other values, and the limit is
          read from the table rather than supplied by another product. */}
      {form.family === "conditional" && (
        <>
          <LookupEditor
            value={form.lookup ?? { inputs: [], rows: [] }}
            onChange={(lookup: LookupTable) => patch({ lookup })}
            attributes={attributes}
          />
          <LookupLimit
            rows={form.lookup?.rows ?? []}
            limitAttr={operandUuid(form.consumer)}
            attributes={attributes}
            onLimitAttr={(uuid) => patch({ consumer: toOperand(uuid) })}
            onLimit={(at, limit) => {
              const rows = form.lookup?.rows ?? [];
              patch({
                lookup: {
                  inputs: form.lookup?.inputs ?? [],
                  rows: (rows.length > 0
                    ? rows
                    : [
                        {
                          when: { op: "exists" as const, attr: "" },
                          limit: 0,
                        },
                      ]
                  ).map((row, position) =>
                    position === at ? { ...row, limit } : row,
                  ),
                },
              });
            }}
          />
        </>
      )}

      {/* The rule read back as one line, built from the form rather than
          written by hand — so it cannot describe something the form is not
          about to save. */}
      <p className="rounded-control bg-primary-tint px-3 py-2 font-mono text-[11px] text-primary">
        {shorthand}
      </p>

      {/* Everything wrong with the rule, at once — the author fixes the set
          rather than resubmitting to discover the next one. */}
      {problems.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-card border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          {problems.map((problem) => (
            <li
              key={`${problem.field}-${problem.message}`}
              className="flex items-start gap-1.5 text-xs text-amber-500"
            >
              <TriangleAlert size={12} className="mt-0.5 shrink-0" />
              {problem.message}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {checked && problems.length === 0 && (
          <span className="mr-auto flex items-center gap-1.5 text-xs text-emerald-400">
            <Check size={13} />
            Nothing wrong with this rule.
          </span>
        )}
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="outline"
          onClick={check}
          disabled={pending || checking}
        >
          {checking ? "Checking…" : "Check"}
        </Button>
        <Button
          onClick={submit}
          disabled={pending || checking || form.name.trim() === ""}
        >
          {initial ? "Save" : "Create"}
        </Button>
      </div>
    </div>
  );
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-amber-500/15 text-amber-500",
  published: "bg-emerald-500/15 text-emerald-400",
  archived: "bg-hover text-faint",
};

export const RelationBuilder = ({
  relationships,
  attributes,
  variables,
  categoryOptions,
}: RelationBuilderProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  const run = (action: () => Promise<{ error?: string }>): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setAdding(false);
      setEditing(null);
      router.refresh();
    });
  };

  const describeSides = (row: SelectRelationships): string => {
    const name = (operand: Operand | null): string => {
      if (!operand) {
        return "—";
      }
      if (operand.source === "spec") {
        const attribute = attributes.find(
          (entry) => entry.uuid === operand.specUuid,
        );
        if (!attribute) {
          return "a deleted attribute";
        }
        if (!operand.groupField) {
          return attribute.label;
        }
        // The column, not just the attribute — "Network Ports" alone would not
        // say whether the rule counts ports or the wattage beside them.
        const field = attribute.groupFields.find(
          (entry) => entry.key === operand.groupField,
        );
        const column = `${attribute.label} · ${field?.label ?? "a removed sub-field"}`;
        // And that only some rows were counted. A rule totalling the 10G ports
        // and one totalling every port read identically without this, which is
        // the difference between a rule an author trusts and one they re-check.
        return operand.where
          ? `${column} (${describeRowFilter(operand.where, attribute)})`
          : column;
      }
      if (operand.source === "variable") {
        return (
          variables.find((entry) => entry.uuid === operand.variableUuid)
            ?.label ?? "a deleted input"
        );
      }
      if (operand.source === "item_count") {
        return "item count";
      }
      return String(operand.value);
    };
    if (row.family === "presence") {
      return `when ${describePredicate(row.presence?.trigger ?? null, attributes, categoryOptions)}`;
    }
    if (row.family === "conditional") {
      return `${name(row.consumer ?? null)} vs a lookup table`;
    }
    return `${name(row.consumer ?? null)} ${RELATIONSHIP_COMPARATOR_LABELS[row.comparator]} ${name(row.provider ?? null)}`;
  };

  return (
    <div className="flex flex-col gap-3">
      {error && !adding && !editing && (
        <p className="rounded-card border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {adding ? (
        <RelationForm
          attributes={attributes}
          variables={variables}
          categoryOptions={categoryOptions}
          pending={pending}
          error={error}
          onCancel={() => {
            setAdding(false);
            setError(undefined);
          }}
          onSubmit={(input) => run(() => addRelationAction(input))}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-fit items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
        >
          <Plus size={13} />
          New relation
        </button>
      )}

      {relationships.length === 0 && !adding && (
        <p className="rounded-card border border-dashed border-hairline px-3 py-8 text-center text-xs text-faint">
          No relations yet.
        </p>
      )}

      {relationships.map((row) =>
        editing === row.uuid ? (
          <RelationForm
            key={row.uuid}
            initial={row}
            attributes={attributes}
            variables={variables}
            categoryOptions={categoryOptions}
            pending={pending}
            error={error}
            onCancel={() => {
              setEditing(null);
              setError(undefined);
            }}
            onSubmit={(input) =>
              run(() => updateRelationAction(row.uuid, input))
            }
          />
        ) : (
          <div key={row.uuid} className="flex flex-col gap-2">
            <div className="flex items-start gap-3 rounded-card border border-hairline bg-surface px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {row.name}
                  </span>
                  {/* Every rule authored here is live, so a badge saying so on
                      every row is noise. It appears only for a row left over
                      from the old draft/publish lifecycle, which is off and has
                      no button to turn it back on — silence would make it look
                      like it was working. */}
                  {row.status !== "published" && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[row.status]}`}
                    >
                      {RELATIONSHIP_STATUS_LABELS[row.status]} — not applied
                    </span>
                  )}
                  <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
                    {RELATIONSHIP_FAMILY_LABELS[row.family].split(" — ")[0]}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      row.gate === "block"
                        ? "bg-red-500/15 text-red-400"
                        : "bg-amber-500/15 text-amber-500"
                    }`}
                  >
                    {RELATIONSHIP_GATE_LABELS[row.gate]}
                  </span>
                  {row.headroomPercent !== 100 && (
                    <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
                      {row.headroomPercent}% headroom
                    </span>
                  )}
                </div>

                <p className="mt-1 font-mono text-[11px] text-muted">
                  {describeSides(row)}
                </p>
                {row.description && (
                  <p className="mt-0.5 text-xs text-faint">{row.description}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {/* Before Publish, deliberately — the point of a draft is that it
                  can be tried on a real basket while it still gates nothing. */}
                <button
                  type="button"
                  onClick={() =>
                    setPreviewing((current) =>
                      current === row.uuid ? null : row.uuid,
                    )
                  }
                  aria-label={`Try ${row.name} on a basket`}
                  className={`flex items-center gap-1 rounded-control px-2 py-1.5 text-[11px] hover:bg-hover ${
                    previewing === row.uuid
                      ? "text-primary"
                      : "text-faint hover:text-ink"
                  }`}
                >
                  <FlaskConical size={12} />
                  Try it
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(row.uuid)}
                  aria-label={`Edit ${row.name}`}
                  className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-ink"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => run(() => deleteRelationAction(row.uuid))}
                  disabled={pending}
                  aria-label={`Delete ${row.name}`}
                  className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {previewing === row.uuid && (
              <RelationPreview
                relation={row}
                variables={variables}
                onClose={() => setPreviewing(null)}
              />
            )}
          </div>
        ),
      )}
    </div>
  );
};
