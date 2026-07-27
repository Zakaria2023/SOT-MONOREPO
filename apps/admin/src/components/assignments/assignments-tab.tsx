"use client";

import {
  removeAssignmentAction,
  saveAssignmentAction,
  suppressAssignmentAction,
  type AssignmentInput,
} from "@/app/(dashboard)/assignments/actions";
import {
  PredicateEditor,
  describePredicate,
  type PredicateAttribute,
} from "@/components/assignments/predicate-editor";
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

type AssignmentCardProps = {
  categoryUuid: string;
  assignment: ResolvedAssignment;
  // Attributes usable as a reveal trigger: anything this category resolves,
  // minus the attribute itself. Inherited triggers are allowed — otherwise every
  // branch-level attribute would have to be re-assigned on each leaf just to be
  // usable, which defeats inheritance.
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
  options: assignment.definition.options,
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

  const [isFilter, setIsFilter] = useState(assignment.isFilter);
  const [isRule, setIsRule] = useState(assignment.isRule);
  const [scope, setScope] = useState<AssignmentScope>(assignment.scope);
  const [audience, setAudience] = useState<AssignmentAudience>(
    assignment.audience,
  );
  const [showIf, setShowIf] = useState<Predicate | null>(assignment.showIf);
  const [enabled, setEnabled] = useState<string[]>(
    assignment.enabledValues ?? [],
  );

  const { definition } = assignment;
  const optionBacked =
    definition.type === "single_select" || definition.type === "multi_select";
  const liveOptions = definition.options.filter((option) => !option.retired);

  const save = (): void => {
    setError(undefined);
    const input: AssignmentInput = {
      categoryUuid,
      specificationUuid: definition.uuid,
      isFilter,
      isRule,
      scope,
      showIf,
      audience,
      enabledValues: enabled.length > 0 ? enabled : null,
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

  // The "up to" helper: on an ordered scale, pick everything at or below one
  // option. The slice stored is still the literal list of values — the helper
  // just fills it in, so nothing is reinterpreted later.
  const fillUpTo = (value: string): void => {
    const ceiling = liveOptions.find((option) => option.value === value);
    const rank = ceiling?.rank;
    if (rank === undefined || rank === null) {
      setEnabled([value]);
      return;
    }
    setEnabled(
      liveOptions
        .filter((option) => option.rank !== null && option.rank <= rank)
        .map((option) => option.value),
    );
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
            {!assignment.isFilter && assignment.isRule && (
              <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
                living
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
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Checkbox
              label="Shopper sees it (filter)"
              checked={isFilter}
              onChange={(event) => setIsFilter(event.target.checked)}
            />
            <Checkbox
              label="Engine reads it (rule)"
              checked={isRule}
              onChange={(event) => setIsRule(event.target.checked)}
            />
          </div>

          {!isFilter && isRule && (
            <p className="-mt-2 text-[11px] text-muted">
              A <strong className="text-secondary">living</strong> attribute:
              invisible to the shopper, still read by the engine. An access
              point&apos;s uplink speed is never shopped by, but the engine needs
              it to size the switch.
            </p>
          )}
          {isRule && (
            <p className="-mt-2 text-[11px] text-amber-500">
              Because the engine reads this, every product in this category must
              have a value for it before it can be sold — a blank would make the
              product silently pass every rule that reads it.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {isFilter && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-secondary">
                  Filter reaches
                </span>
                <Dropdown
                  value={scope}
                  onChange={(next) => setScope(next as AssignmentScope)}
                  options={SCOPE_OPTIONS}
                />
                <span className="text-[11px] text-muted">
                  Affects the shopper&apos;s facet only. Rule participation
                  always inherits down the whole subtree.
                </span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-secondary">
                Surfaced to
              </span>
              <Dropdown
                value={audience}
                onChange={(next) => setAudience(next as AssignmentAudience)}
                options={AUDIENCE_OPTIONS}
              />
              {definition.audience !== "everyone" && (
                <span className="text-[11px] text-amber-500">
                  The library marks this{" "}
                  {ASSIGNMENT_AUDIENCE_LABELS[definition.audience]} — a category
                  can narrow that, never widen it.
                </span>
              )}
            </div>
          </div>

          {optionBacked && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-secondary">
                  Options this category offers
                </span>
                <button
                  type="button"
                  onClick={() => setEnabled([])}
                  className="rounded-control px-2 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-ink"
                >
                  offer all
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {liveOptions.map((option) => {
                  const picked =
                    enabled.length === 0 || enabled.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setEnabled((current) => {
                          const base =
                            current.length === 0
                              ? liveOptions.map((entry) => entry.value)
                              : current;
                          return base.includes(option.value)
                            ? base.filter((entry) => entry !== option.value)
                            : [...base, option.value];
                        })
                      }
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        picked
                          ? "bg-primary/20 text-primary"
                          : "bg-hover text-faint hover:text-secondary"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {definition.ordered && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-faint">up to:</span>
                  {liveOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => fillUpTo(option.value)}
                      className="rounded-control bg-hover px-1.5 py-0.5 text-[11px] text-secondary hover:text-ink"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-muted">
                Exactly the options ticked here are offered — gaps included.
                Nothing is re-expanded later, so what you pick is what the
                shopper and the product form get.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-secondary">
              Shown only when
            </span>
            <PredicateEditor
              value={showIf}
              onChange={setShowIf}
              attributes={triggers}
              emptyLabel="Always shown"
            />
            {showIf && (
              <p className="text-[11px] text-muted">
                When this stops matching, the field is hidden{" "}
                <strong className="text-secondary">and its value cleared</strong>{" "}
                — a leftover number on a hidden field would still be feeding the
                engine.
              </p>
            )}
          </div>

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const [error, setError] = useState<string>();

  const assigned = useMemo(
    () => new Set(resolved.map((entry) => entry.definition.uuid)),
    [resolved],
  );

  const triggers = useMemo(
    () => resolved.map(toPredicateAttribute),
    [resolved],
  );

  const addOptions = useMemo<DropdownOption[]>(
    () =>
      library
        .filter((attribute) => !assigned.has(attribute.uuid))
        .map((attribute) => ({
          value: attribute.uuid,
          label: attribute.unit
            ? `${attribute.label} (${attribute.unit})`
            : attribute.label,
        })),
    [library, assigned],
  );

  const add = (uuid: string): void => {
    setAdding(uuid);
    setError(undefined);
    startTransition(async () => {
      const result = await saveAssignmentAction({
        categoryUuid,
        specificationUuid: uuid,
        // Sensible default: the engine reads it, the shopper does not filter on
        // it yet. Turning the filter on is a deliberate merchandising decision.
        isFilter: false,
        isRule: true,
        scope: "branch",
        showIf: null,
        audience: "everyone",
        enabledValues: null,
        suppressed: false,
        order: resolved.length,
      });
      setAdding("");
      if (result.error) {
        setError(result.error);
        return;
      }
      setExpanded(uuid);
      router.refresh();
    });
  };

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
        <div className="w-64">
          <Dropdown
            value={adding}
            onChange={add}
            options={addOptions}
            searchable
            triggerLabel="+ Add attribute"
            emptyMessage="Every library attribute is already here"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-card border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {resolved.length === 0 && (
        <p className="rounded-card border border-dashed border-hairline px-3 py-8 text-center text-xs text-faint">
          Nothing assigned yet. Add an attribute from the library, or assign it
          higher up the tree so a whole branch inherits it.
        </p>
      )}

      {resolved.map((assignment) => (
        <AssignmentCard
          key={assignment.definition.uuid}
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

      {pending && <p className="text-xs text-faint">Saving…</p>}
    </div>
  );
};
