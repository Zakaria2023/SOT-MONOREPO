"use client";

import {
  removeAssignmentAction,
  saveAssignmentAction,
  suppressAssignmentAction,
  type AssignmentInput,
} from "@/app/(dashboard)/assignments/actions";
import {
  ConditionPicker,
  describePredicate,
  type PredicateAttribute,
} from "@/components/assignments/condition-picker";
import { Field } from "@/components/shared/field";
import type { AssignmentAudience, AssignmentScope } from "@/db/enum";
import { assignmentAudiences, assignmentScopes } from "@/db/enum";
import {
  ASSIGNMENT_AUDIENCE_LABELS,
  ASSIGNMENT_SCOPE_LABELS,
} from "@/db/label";
import type { Predicate } from "@/db/types";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Hash,
  ListChecks,
  Plus,
  ToggleLeft,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { ResolvedAssignment, RevealProblem } from "services";
import { Button, Checkbox, Dropdown, type DropdownOption } from "ui";

type AssignmentsTabProps = {
  categoryUuid: string;
  resolved: ResolvedAssignment[];
  problems: RevealProblem[];
  // Every attribute in the library, for the "add attribute" picker.
  library: PredicateAttribute[];
};

// The seven switches, as the form holds them. Shared by the add form and the
// edit expansion so the two cannot drift into offering different things.
type Draft = {
  isFilter: boolean;
  isRule: boolean;
  scope: AssignmentScope;
  audience: AssignmentAudience;
  showIf: Predicate | null;
  enabledValues: string[];
};

type AssignmentFieldsProps = {
  draft: Draft;
  onChange: (next: Partial<Draft>) => void;
  // The attribute being configured — its type decides which switches apply.
  attribute: PredicateAttribute;
  // The library's own audience floor, when it set one — a category may narrow
  // it, never widen it. Absent while ADDING, because the picker only carries
  // what a condition needs; the server enforces the narrowing either way, so the
  // note is omitted rather than guessed at.
  libraryAudience?: AssignmentAudience;
  // Attributes usable as a condition: everything this category carries, minus
  // the attribute itself. Inherited ones are allowed — otherwise every
  // branch-level attribute would have to be re-assigned on each leaf just to be
  // usable, which defeats inheritance.
  triggers: PredicateAttribute[];
};

type AddAssignmentFormProps = {
  categoryUuid: string;
  // Everything in the library this category does not already carry.
  available: PredicateAttribute[];
  triggers: PredicateAttribute[];
  order: number;
  onDone: () => void;
  onCancel: () => void;
};

type AssignmentCardProps = {
  categoryUuid: string;
  assignment: ResolvedAssignment;
  triggers: PredicateAttribute[];
  expanded: boolean;
  onToggle: () => void;
  onSaved: () => void;
};

const SCOPE_OPTIONS: DropdownOption[] = assignmentScopes.map((scope) => ({
  value: scope,
  label: ASSIGNMENT_SCOPE_LABELS[scope],
}));

const AUDIENCE_OPTIONS: DropdownOption[] = assignmentAudiences.map(
  (audience) => ({
    value: audience,
    label: ASSIGNMENT_AUDIENCE_LABELS[audience],
  }),
);

const toPredicateAttribute = (
  assignment: ResolvedAssignment,
): PredicateAttribute => ({
  uuid: assignment.definition.uuid,
  label: assignment.definition.label,
  type: assignment.definition.type,
  ordered: assignment.definition.ordered,
  unit: assignment.definition.unit,
  // The slice this category OFFERS, not the master list — a condition must not
  // be able to name a value the category does not put on the form.
  options: assignment.offeredOptions,
});

// Sensible defaults for a brand-new assignment: the engine reads it, the shopper
// does not filter on it yet. Turning the filter on is a deliberate
// merchandising decision, so it is never on by accident.
const emptyDraft = (): Draft => ({
  isFilter: false,
  isRule: true,
  scope: "branch",
  audience: "everyone",
  showIf: null,
  enabledValues: [],
});

const toDraft = (assignment: ResolvedAssignment): Draft => ({
  isFilter: assignment.isFilter,
  isRule: assignment.isRule,
  scope: assignment.scope,
  audience: assignment.audience,
  showIf: assignment.showIf,
  enabledValues: assignment.enabledValues ?? [],
});

const TypeIcon = ({ assignment }: { assignment: ResolvedAssignment }) => {
  const { type, ordered } = assignment.definition;
  if (type === "number") {
    return <Hash size={14} className="text-faint" />;
  }
  if (type === "boolean") {
    return <ToggleLeft size={14} className="text-faint" />;
  }
  if (type === "multi_select") {
    return <ListChecks size={14} className="text-faint" />;
  }
  return ordered ? (
    <ArrowUpDown size={14} className="text-faint" />
  ) : (
    <ListChecks size={14} className="text-faint" />
  );
};

/**
 * The switches themselves. No save button, no fetching — it holds nothing and
 * decides nothing, so adding an attribute and editing one are the same screen
 * and cannot offer different options.
 */
const AssignmentFields = ({
  draft,
  onChange,
  attribute,
  libraryAudience,
  triggers,
}: AssignmentFieldsProps) => {
  const optionBacked =
    attribute.type === "single_select" || attribute.type === "multi_select";
  const liveOptions = attribute.options.filter((option) => !option.retired);

  return (
    <>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox
          label="Shopper sees it (filter)"
          checked={draft.isFilter}
          onChange={(event) => onChange({ isFilter: event.target.checked })}
        />
        <Checkbox
          label="Engine reads it (rule)"
          checked={draft.isRule}
          onChange={(event) => onChange({ isRule: event.target.checked })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {draft.isFilter && (
          <Field
            label="Filter reaches"
            hint="Affects the shopper's facet only. Rule participation always inherits down the whole subtree."
          >
            <Dropdown
              value={draft.scope}
              onChange={(next) => onChange({ scope: next as AssignmentScope })}
              options={SCOPE_OPTIONS}
            />
          </Field>
        )}

        <Field label="Surfaced to">
          <Dropdown
            value={draft.audience}
            onChange={(next) =>
              onChange({ audience: next as AssignmentAudience })
            }
            options={AUDIENCE_OPTIONS}
          />
          {libraryAudience && libraryAudience !== "everyone" && (
            <span className="text-[11px] text-amber-500">
              The library marks this{" "}
              {ASSIGNMENT_AUDIENCE_LABELS[libraryAudience]} — a category can
              narrow that, never widen it.
            </span>
          )}
        </Field>
      </div>

      {optionBacked && (
        <Field
          label="Options this category offers"
          hint={
            draft.enabledValues.length === 0
              ? "Every option, including any added to the library later."
              : "Exactly these are offered — gaps included. Nothing is re-expanded later, so what you pick is what the shopper and the product form get."
          }
          accessory={
            draft.enabledValues.length > 0 && (
              <button
                type="button"
                onClick={() => onChange({ enabledValues: [] })}
                className="rounded-control px-2 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-ink"
              >
                Offer all
              </button>
            )
          }
        >
          <Dropdown
            multiple
            value={draft.enabledValues}
            onChange={(enabledValues) => onChange({ enabledValues })}
            options={liveOptions.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            // Empty is not "nothing offered" — it is the unrestricted case,
            // which is why it stays distinct from ticking every box.
            placeholder={`All ${liveOptions.length} options`}
            searchable={liveOptions.length > 8}
          />
        </Field>
      )}

      <Field label="Shown only when">
        <ConditionPicker
          value={draft.showIf}
          onChange={(showIf) => onChange({ showIf })}
          attributes={triggers}
          emptyLabel="Always shown"
        />
      </Field>
    </>
  );
};

/**
 * Adding an attribute.
 *
 * Deliberately a form that saves ONCE. The old flow wrote a row with defaults
 * the moment an attribute was picked and then opened it for editing — so a
 * cancelled thought left a live assignment behind, and for the seconds in
 * between, every product in the category was quietly incomplete.
 */
const AddAssignmentForm = ({
  categoryUuid,
  available,
  triggers,
  order,
  onDone,
  onCancel,
}: AddAssignmentFormProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [picked, setPicked] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  const attribute = available.find((entry) => entry.uuid === picked);

  const save = (): void => {
    if (!attribute) {
      return;
    }
    setError(undefined);
    const input: AssignmentInput = {
      categoryUuid,
      specificationUuid: attribute.uuid,
      isFilter: draft.isFilter,
      isRule: draft.isRule,
      scope: draft.scope,
      showIf: draft.showIf,
      audience: draft.audience,
      enabledValues:
        draft.enabledValues.length > 0 ? draft.enabledValues : null,
      suppressed: false,
      order,
    };
    startTransition(async () => {
      const result = await saveAssignmentAction(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      onDone();
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-card border border-primary/40 bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">Add an attribute</span>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>

      <Field label="Attribute">
        <Dropdown
          value={picked}
          onChange={(next) => {
            setPicked(next);
            // A fresh attribute means a fresh set of switches — carrying an
            // option slice or a condition across from the last pick would name
            // values the new attribute does not have.
            setDraft(emptyDraft());
          }}
          options={available.map((entry) => ({
            value: entry.uuid,
            label: entry.unit ? `${entry.label} (${entry.unit})` : entry.label,
          }))}
          searchable
          placeholder="Choose an attribute"
          emptyMessage="Every library attribute is already here"
        />
      </Field>

      {/* The switches wait for an attribute, because its TYPE decides which of
          them apply at all — there is no option slice on a number. */}
      {attribute && (
        <AssignmentFields
          draft={draft}
          onChange={(next) => setDraft((current) => ({ ...current, ...next }))}
          attribute={attribute}
          triggers={triggers}
        />
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={save} disabled={pending || !attribute}>
          {pending ? "Adding…" : "Add to this category"}
        </Button>
      </div>
    </div>
  );
};

const AssignmentCard = ({
  categoryUuid,
  assignment,
  triggers,
  expanded,
  onToggle,
  onSaved,
}: AssignmentCardProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [draft, setDraft] = useState<Draft>(toDraft(assignment));

  const { definition } = assignment;
  const optionBacked =
    definition.type === "single_select" || definition.type === "multi_select";
  const liveOptions = definition.options.filter((option) => !option.retired);

  const save = (): void => {
    setError(undefined);
    const input: AssignmentInput = {
      categoryUuid,
      specificationUuid: definition.uuid,
      isFilter: draft.isFilter,
      isRule: draft.isRule,
      scope: draft.scope,
      showIf: draft.showIf,
      audience: draft.audience,
      enabledValues:
        draft.enabledValues.length > 0 ? draft.enabledValues : null,
      suppressed: false,
      order: assignment.order,
    };
    startTransition(async () => {
      const result = await saveAssignmentAction(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
      router.refresh();
    });
  };

  const remove = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = assignment.inherited
        ? await suppressAssignmentAction(categoryUuid, definition.uuid)
        : await removeAssignmentAction(categoryUuid, definition.uuid);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div
      className={`rounded-card border bg-surface ${
        assignment.inherited ? "border-hairline" : "border-primary/25"
      }`}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="mt-0.5">
          <TypeIcon assignment={assignment} />
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink">
              {definition.label}
            </span>
            {assignment.inherited && (
              <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
                inherited
              </span>
            )}
            {assignment.isFilter && (
              <span className="flex items-center gap-1 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] text-blue-400">
                <Eye size={9} />
                filter
              </span>
            )}
            {assignment.isRule && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
                <Zap size={9} />
                rule
              </span>
            )}
            {assignment.effectiveAudience !== "everyone" && (
              <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
                {ASSIGNMENT_AUDIENCE_LABELS[assignment.effectiveAudience]}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
            {assignment.showIf ? (
              <span className="flex items-center gap-1 text-amber-500">
                <EyeOff size={10} />
                shown when {describePredicate(assignment.showIf, triggers)}
              </span>
            ) : (
              <span className="text-faint">always shown</span>
            )}
            {optionBacked && (
              <span>
                {assignment.enabledValues
                  ? `${assignment.offeredOptions.length} of ${liveOptions.length} options`
                  : `all ${liveOptions.length} options`}
              </span>
            )}
            {assignment.isFilter && (
              <span>{ASSIGNMENT_SCOPE_LABELS[assignment.scope]}</span>
            )}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? "Collapse" : "Edit"}
            className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-ink"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label={
              assignment.inherited
                ? `Drop ${definition.label} from this category`
                : `Remove ${definition.label}`
            }
            className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-hairline px-3 py-3">
          <AssignmentFields
            draft={draft}
            onChange={(next) =>
              setDraft((current) => ({ ...current, ...next }))
            }
            attribute={{
              uuid: definition.uuid,
              label: definition.label,
              type: definition.type,
              ordered: definition.ordered,
              unit: definition.unit,
              options: definition.options,
            }}
            libraryAudience={definition.audience}
            triggers={triggers}
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onToggle} disabled={pending}>
              Close
            </Button>
            <Button onClick={save} disabled={pending}>
              {assignment.inherited ? "Override here" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const AssignmentsTab = ({
  categoryUuid,
  resolved,
  problems,
  library,
}: AssignmentsTabProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  // Whether the add form is open. Nothing is written until it is submitted.
  const [adding, setAdding] = useState(false);

  const assigned = useMemo(
    () => new Set(resolved.map((entry) => entry.definition.uuid)),
    [resolved],
  );

  const triggers = useMemo(
    () => resolved.map(toPredicateAttribute),
    [resolved],
  );

  const unassigned = useMemo(
    () => library.filter((attribute) => !assigned.has(attribute.uuid)),
    [library, assigned],
  );

  return (
    <div className="flex flex-col gap-3">
      {problems.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-card border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          {problems.map((problem) => (
            <p
              key={`${problem.specificationUuid}-${problem.code}`}
              className="flex items-start gap-1.5 text-xs text-amber-500"
            >
              <TriangleAlert size={12} className="mt-0.5 shrink-0" />
              {problem.message}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {resolved.length} attribute{resolved.length === 1 ? "" : "s"} —{" "}
          {resolved.filter((entry) => !entry.inherited).length} authored here
        </p>
        {!adding && (
          <Button
            variant="outline"
            onClick={() => setAdding(true)}
            disabled={unassigned.length === 0}
          >
            <Plus size={14} />
            Add attribute
          </Button>
        )}
      </div>

      {adding && (
        <AddAssignmentForm
          categoryUuid={categoryUuid}
          available={unassigned}
          triggers={triggers}
          order={resolved.length}
          onDone={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      )}

      {resolved.length === 0 && !adding && (
        <p className="rounded-card border border-dashed border-hairline px-3 py-8 text-center text-xs text-faint">
          Nothing assigned yet. Add an attribute from the library, or assign it
          higher up the tree so a whole branch inherits it.
        </p>
      )}

      {resolved.map((assignment) => (
        <AssignmentCard
          // Keyed by what the row currently HOLDS, not just its uuid — a card
          // that stays mounted across a refresh keeps the draft it was opened
          // with, so a save would show stale switches until the page reloaded.
          key={`${assignment.definition.uuid}-${assignment.sourceCategoryUuid}`}
          categoryUuid={categoryUuid}
          assignment={assignment}
          triggers={triggers.filter(
            (entry) => entry.uuid !== assignment.definition.uuid,
          )}
          expanded={expanded === assignment.definition.uuid}
          onToggle={() =>
            setExpanded((current) =>
              current === assignment.definition.uuid
                ? null
                : assignment.definition.uuid,
            )
          }
          onSaved={() => setExpanded(null)}
        />
      ))}
    </div>
  );
};
