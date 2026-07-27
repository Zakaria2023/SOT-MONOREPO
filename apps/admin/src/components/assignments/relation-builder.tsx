"use client";

import {
  addRelationAction,
  archiveRelationAction,
  deleteRelationAction,
  publishRelationAction,
  updateRelationAction,
  validateRelationAction,
  type RelationshipInput,
  type RelationshipProblem,
} from "@/app/(dashboard)/assignments/actions";
import { OperandPicker } from "@/components/assignments/operand-picker";
import { RelationPreview } from "@/components/assignments/relation-preview";
import { Field, FieldSet } from "@/components/shared/field";
import { PresenceEditor } from "@/components/assignments/presence-editor";
import {
  ConditionPicker,
  describePredicate,
  type PredicateAttribute,
} from "@/components/assignments/condition-picker";
import { LookupEditor } from "@/components/assignments/lookup-editor";
import type {
  MatchMode,
  ProjectVariableType,
  RelationshipAllocation,
  RelationshipComparator,
  RelationshipFamily,
  RelationshipGate,
} from "@/db/enum";
import {
  matchModes,
  relationshipAllocations,
  relationshipFamilies,
  relationshipGates,
} from "@/db/enum";
import {
  MATCH_MODE_LABELS,
  RELATIONSHIP_ALLOCATION_HINTS,
  RELATIONSHIP_ALLOCATION_LABELS,
  RELATIONSHIP_COMPARATOR_LABELS,
  RELATIONSHIP_FAMILY_HINTS,
  RELATIONSHIP_FAMILY_LABELS,
  RELATIONSHIP_GATE_LABELS,
  RELATIONSHIP_STATUS_LABELS,
} from "@/db/label";
import type { LookupTable, Operand, Predicate, PresenceSpec } from "@/db/types";
import {
  Archive,
  Check,
  FlaskConical,
  Pencil,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SelectRelationships } from "@/db/schema/relationships";
import {
  Button,
  Checkbox,
  ConfirmDialog,
  Dropdown,
  Input,
  type DropdownOption,
} from "ui";

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
};

type RelationFormProps = {
  initial?: SelectRelationships;
  attributes: PredicateAttribute[];
  variables: RelationVariable[];
  onSubmit: (input: RelationshipInput) => void;
  onCancel: () => void;
  pending: boolean;
  error?: string;
};

const FAMILY_OPTIONS: DropdownOption[] = relationshipFamilies.map((family) => ({
  value: family,
  label: RELATIONSHIP_FAMILY_LABELS[family],
}));

const GATE_OPTIONS: DropdownOption[] = relationshipGates.map((gate) => ({
  value: gate,
  label: RELATIONSHIP_GATE_LABELS[gate],
}));

const ALLOCATION_OPTIONS: DropdownOption[] = relationshipAllocations.map(
  (allocation) => ({
    value: allocation,
    label: RELATIONSHIP_ALLOCATION_LABELS[allocation],
  }),
);

// Which comparators a family can actually use. Offering "must overlap" on a
// budget would produce a rule that cannot be evaluated.
const comparatorsFor = (
  family: RelationshipFamily,
): RelationshipComparator[] => {
  if (family === "match") {
    return ["in", "intersects", "eq", "lte", "gte"];
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
              trigger: { op: "exists", attr: attributes[0]?.uuid ?? "" },
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

  const capacityFamily =
    form.family === "budget" ||
    form.family === "count" ||
    form.family === "ratio";

  return (
    <div className="flex flex-col gap-4 rounded-card border border-primary/40 bg-surface p-4">
      <Input
        label="Name the buyer will see"
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

      {form.family === "presence" ? (
        <PresenceEditor
          value={
            form.presence ?? {
              trigger: { op: "exists", attr: attributes[0]?.uuid ?? "" },
              requires: [],
              suggestedFix: null,
            }
          }
          onChange={(presence: PresenceSpec) => patch({ presence })}
          attributes={attributes}
          variables={variables}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FieldSet
              title={form.family === "ratio" ? "Demand" : "What is measured"}
            >
              <OperandPicker
                value={form.consumer}
                onChange={(consumer: Operand | null) => patch({ consumer })}
                attributes={attributes}
                variables={variables}
                allowItemCount={form.family === "count"}
              />
              <Field label="Which items count">
                <ConditionPicker
                  value={form.consumerWhen}
                  onChange={(consumerWhen: Predicate | null) =>
                    patch({ consumerWhen })
                  }
                  attributes={attributes}
                  emptyLabel="Anything carrying that attribute"
                />
              </Field>
            </FieldSet>

            {form.family !== "conditional" && (
              <FieldSet
                title={
                  form.family === "ratio" ? "Supply" : "What supplies the limit"
                }
              >
                <OperandPicker
                  value={form.provider}
                  onChange={(provider: Operand | null) => patch({ provider })}
                  attributes={attributes}
                  variables={variables}
                />
                <Field label="Which items supply it">
                  <ConditionPicker
                    value={form.providerWhen}
                    onChange={(providerWhen: Predicate | null) =>
                      patch({ providerWhen })
                    }
                    attributes={attributes}
                    emptyLabel="Anything carrying that attribute"
                  />
                </Field>
              </FieldSet>
            )}
          </div>

          {form.family === "conditional" && (
            <LookupEditor
              value={form.lookup ?? { inputs: [], rows: [] }}
              onChange={(lookup: LookupTable) => patch({ lookup })}
              attributes={attributes}
            />
          )}
        </>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {form.family !== "presence" && (
          <Field label="Comparison">
            <Dropdown
              value={form.comparator}
              onChange={(next) =>
                patch({ comparator: next as RelationshipComparator })
              }
              options={comparatorOptions}
            />
          </Field>
        )}

        {form.family === "match" && (
          <Field label="On several values">
            <Dropdown
              value={form.matchMode}
              onChange={(next) => patch({ matchMode: next as MatchMode })}
              options={matchModes.map((mode) => ({
                value: mode,
                label: MATCH_MODE_LABELS[mode],
              }))}
            />
          </Field>
        )}

        {capacityFamily && (
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
        )}

        {form.family === "ratio" && (
          <Input
            label="Target ratio (N:1)"
            type="number"
            value={form.ratioLimit === null ? "" : String(form.ratioLimit)}
            onChange={(event) =>
              patch({
                ratioLimit:
                  event.target.value === "" ? null : Number(event.target.value),
              })
            }
          />
        )}

        <Field label="When it fails">
          <Dropdown
            value={form.gate}
            onChange={(next) => patch({ gate: next as RelationshipGate })}
            options={GATE_OPTIONS}
          />
        </Field>
      </div>

      {(form.family === "budget" || form.family === "count") && (
        <Field
          label="How capacity is applied"
          hint={RELATIONSHIP_ALLOCATION_HINTS[form.allocation]}
        >
          <Dropdown
            value={form.allocation}
            onChange={(next) =>
              patch({ allocation: next as RelationshipAllocation })
            }
            options={ALLOCATION_OPTIONS}
          />
        </Field>
      )}

      {form.family === "budget" && (
        <div className="flex flex-col gap-1">
          <Checkbox
            label="Judge each item on its own, against the single best supplier value"
            checked={form.perItem}
            onChange={(event) => patch({ perItem: event.target.checked })}
          />
          <span className="pl-6 text-[11px] text-muted">
            One camera&apos;s draw against the per-port maximum, rather than the
            total against the whole budget.
          </span>
        </div>
      )}

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
          {initial ? "Save draft" : "Create draft"}
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
}: RelationBuilderProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState<SelectRelationships | null>(
    null,
  );

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
      setConfirming(null);
      router.refresh();
    });
  };

  const describeSides = (row: SelectRelationships): string => {
    const name = (operand: Operand | null): string => {
      if (!operand) {
        return "—";
      }
      if (operand.source === "spec") {
        return (
          attributes.find((entry) => entry.uuid === operand.specUuid)?.label ??
          "a deleted attribute"
        );
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
      return `when ${describePredicate(row.presence?.trigger ?? null, attributes)}`;
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
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[row.status]}`}
                  >
                    {RELATIONSHIP_STATUS_LABELS[row.status]}
                  </span>
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
                {row.status === "draft" && (
                  <button
                    type="button"
                    onClick={() => run(() => publishRelationAction(row.uuid))}
                    disabled={pending}
                    aria-label={`Publish ${row.name}`}
                    className="flex items-center gap-1 rounded-control px-2 py-1.5 text-[11px] text-emerald-400 hover:bg-hover"
                  >
                    <Send size={12} />
                    Publish
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(row.uuid)}
                  aria-label={`Edit ${row.name}`}
                  className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-ink"
                >
                  <Pencil size={14} />
                </button>
                {row.status === "published" ? (
                  <button
                    type="button"
                    onClick={() => run(() => archiveRelationAction(row.uuid))}
                    disabled={pending}
                    aria-label={`Archive ${row.name}`}
                    className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-amber-500"
                  >
                    <Archive size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(row)}
                    aria-label={`Delete ${row.name}`}
                    className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
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

      {relationships.some((row) => row.status === "draft") && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-500">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" />
          Drafts are not applied to any cart. Publishing re-checks the rule
          against the library first, so a rule pointing at a deleted attribute
          cannot go live.
        </p>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={`Delete “${confirming?.name ?? ""}”?`}
        description="This rule has never been published, so nothing depends on it. Published rules are archived instead."
        confirmLabel="Delete"
        isConfirming={pending}
        error={error}
        onConfirm={() => {
          if (confirming) {
            run(() => deleteRelationAction(confirming.uuid));
          }
        }}
        onCancel={() => {
          setConfirming(null);
          setError(undefined);
        }}
      />
    </div>
  );
};
