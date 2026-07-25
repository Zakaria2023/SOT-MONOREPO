"use client";

import {
  saveAssignments,
  type AssignmentActionResult,
  type AssignmentInput,
  type CategoryAssignment,
  type SpecificationWithCategories,
} from "@/app/(dashboard)/categories/[uuid]/assignments/actions";
import type { AssignmentAudience, AssignmentScope } from "@/db/enum";
import { ASSIGNMENT_AUDIENCE_LABELS, ASSIGNMENT_SCOPE_LABELS } from "@/db/label";
import { assignmentAudiences, assignmentScopes } from "@/db/enum";
import { ArrowUpFromLine, Eye, Layers, Trash2, Zap } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { Button, Checkbox, Dropdown, FormError } from "ui";

type AssignmentBuilderProps = {
  categoryUuid: string;
  categoryName: string;
  // Everything this category carries — its own assignments plus the ones
  // inherited from its ancestors, already resolved nearest-wins.
  assignments: CategoryAssignment[];
  // The whole attribute library, to assign something new from.
  library: SpecificationWithCategories[];
};

// A row being edited. `owned` marks it as authored ON this category: only
// owned rows are saved, so an untouched inherited row keeps flowing from its
// ancestor and still tracks later changes made up there.
type DraftRow = CategoryAssignment & {
  owned: boolean;
};

type AssignmentRowProps = {
  row: DraftRow;
  // Other attributes on this category, as show-if controller candidates.
  controllers: { value: string; label: string }[];
  controllerOptions: Record<string, string[]>;
  onChange: (specificationUuid: string, patch: Partial<DraftRow>) => void;
  onReset: (specificationUuid: string) => void;
  onRemove: (specificationUuid: string) => void;
};

const SCOPE_OPTIONS = assignmentScopes.map((scope) => ({
  value: scope,
  label: ASSIGNMENT_SCOPE_LABELS[scope],
}));

const AUDIENCE_OPTIONS = assignmentAudiences.map((audience) => ({
  value: audience,
  label: ASSIGNMENT_AUDIENCE_LABELS[audience],
}));

const toInput = (row: DraftRow): AssignmentInput => ({
  specificationUuid: row.specificationUuid,
  isFilter: row.isFilter,
  isRule: row.isRule,
  scope: row.scope,
  showIf: row.showIf,
  audience: row.audience,
  enabledValues: row.enabledValues,
  order: row.order,
});

const AssignmentRow = ({
  row,
  controllers,
  controllerOptions,
  onChange,
  onReset,
  onRemove,
}: AssignmentRowProps) => {
  const showIfValues = row.showIf?.values ?? [];
  const enabled = new Set(row.enabledValues ?? row.masterOptions);
  const hasOptions = row.masterOptions.length > 0;

  const toggleEnabled = (option: string) => {
    const current = new Set(row.enabledValues ?? row.masterOptions);
    if (current.has(option)) {
      current.delete(option);
    } else {
      current.add(option);
    }
    // Everything ticked means "no narrowing" — store null rather than a slice
    // that happens to equal the master list, so the category keeps tracking
    // options added to the library later.
    const next = row.masterOptions.filter((value) => current.has(value));
    onChange(row.specificationUuid, {
      enabledValues: next.length === row.masterOptions.length ? null : next,
    });
  };

  const toggleShowIfValue = (value: string) => {
    const current = new Set(showIfValues);
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    const values = [...current];
    onChange(row.specificationUuid, {
      showIf:
        row.showIf && values.length > 0
          ? { specKey: row.showIf.specKey, values }
          : row.showIf
            ? { specKey: row.showIf.specKey, values: [] }
            : null,
    });
  };

  const setController = (specKey: string) =>
    onChange(row.specificationUuid, {
      showIf: specKey ? { specKey, values: [] } : null,
    });

  return (
    <li className="flex flex-col gap-3 rounded-control border border-hairline p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink">{row.label}</span>
        {row.unit && <span className="text-xs text-faint">({row.unit})</span>}
        <span className="rounded bg-page px-1.5 py-0.5 text-[10px] font-semibold text-muted">
          {row.valueType === "number" ? "number" : "select"}
        </span>
        {row.ordered && (
          <span className="rounded bg-primary-tint px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            ordered · ceiling
          </span>
        )}
        {hasOptions && !row.ordered && (
          <span className="rounded bg-page px-1.5 py-0.5 text-[10px] font-semibold text-muted">
            unordered · inclusion
          </span>
        )}
        {row.owned ? (
          <span className="rounded bg-page px-1.5 py-0.5 text-[10px] font-semibold text-muted">
            own
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded bg-page px-1.5 py-0.5 text-[10px] font-semibold text-muted">
            <ArrowUpFromLine size={10} />
            from {row.sourceCategoryName ?? "an ancestor"}
          </span>
        )}

        <span className="ml-auto flex items-center gap-1">
          {row.owned && row.inherited && (
            <button
              type="button"
              onClick={() => onReset(row.specificationUuid)}
              className="rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-page hover:text-ink"
            >
              Reset to inherited
            </button>
          )}
          {row.owned && !row.inherited && (
            <button
              type="button"
              onClick={() => onRemove(row.specificationUuid)}
              aria-label={`Remove ${row.label}`}
              className="rounded p-1.5 text-faint transition-colors hover:bg-page hover:text-danger"
            >
              <Trash2 size={15} />
            </button>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={row.isFilter}
            onChange={(event) =>
              onChange(row.specificationUuid, { isFilter: event.target.checked })
            }
          />
          <span className="flex items-center gap-1 text-xs text-ink">
            <Eye size={13} /> Show as filter
          </span>
        </label>

        <label className="flex items-center gap-2">
          <Checkbox
            checked={row.isRule}
            onChange={(event) =>
              onChange(row.specificationUuid, { isRule: event.target.checked })
            }
          />
          <span className="flex items-center gap-1 text-xs text-ink">
            <Zap size={13} /> Use in rules
          </span>
        </label>

        {row.isFilter && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Reach</span>
            <div className="w-40">
              <Dropdown
                value={row.scope}
                onChange={(value) =>
                  onChange(row.specificationUuid, {
                    scope: value as AssignmentScope,
                  })
                }
                options={SCOPE_OPTIONS}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Visible to</span>
          <div className="w-44">
            <Dropdown
              value={row.audience}
              onChange={(value) =>
                onChange(row.specificationUuid, {
                  audience: value as AssignmentAudience,
                })
              }
              options={AUDIENCE_OPTIONS}
            />
          </div>
        </div>
      </div>

      {!row.isFilter && row.isRule && (
        <p className="text-xs text-faint">
          Living, not showing — the engine reads this value but no shopper ever
          sees it as a filter.
        </p>
      )}

      {hasOptions && (
        <div>
          <p className="text-xs font-semibold text-ink">
            Enabled values{" "}
            <span className="font-normal text-faint">
              {row.ordered
                ? "— an ordered scale, so the highest ticked value is the ceiling and everything below it comes too"
                : "— the slice of the library's master list this category offers"}
            </span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {row.masterOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => toggleEnabled(option)}
                aria-pressed={enabled.has(option)}
                className={
                  enabled.has(option)
                    ? "rounded-md bg-primary px-2 py-1 text-xs font-medium text-white"
                    : "rounded-md border border-hairline bg-page px-2 py-1 text-xs text-faint"
                }
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Show only if</span>
        <div className="w-56">
          <Dropdown
            value={row.showIf?.specKey ?? ""}
            onChange={setController}
            options={[{ value: "", label: "— always shown —" }, ...controllers]}
          />
        </div>
        {row.showIf && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">is</span>
            {(controllerOptions[row.showIf.specKey] ?? []).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleShowIfValue(value)}
                aria-pressed={showIfValues.includes(value)}
                className={
                  showIfValues.includes(value)
                    ? "rounded-md bg-primary px-2 py-1 text-xs font-medium text-white"
                    : "rounded-md border border-hairline bg-page px-2 py-1 text-xs text-faint"
                }
              >
                {value}
              </button>
            ))}
          </div>
        )}
      </div>

      {row.showIf && showIfValues.length === 0 && (
        <p className="text-xs text-amber-700">
          Pick at least one value, or the condition never holds and this
          attribute is always hidden.
        </p>
      )}
    </li>
  );
};

export const AssignmentBuilder = ({
  categoryUuid,
  categoryName,
  assignments,
  library,
}: AssignmentBuilderProps) => {
  const [rows, setRows] = useState<DraftRow[]>(
    assignments.map((assignment) => ({
      ...assignment,
      owned: !assignment.inherited,
    })),
  );

  const [state, dispatch, isPending] = useActionState<
    AssignmentActionResult,
    AssignmentInput[]
  >(
    (prevState, input) => saveAssignments(categoryUuid, prevState, input),
    {},
  );

  const original = new Map(
    assignments.map((assignment) => [assignment.specificationUuid, assignment]),
  );

  // Editing any switch takes ownership of the row — that is what an override
  // is. Until then the row keeps flowing from the ancestor that authored it.
  const patchRow = (specificationUuid: string, patch: Partial<DraftRow>) =>
    setRows((current) =>
      current.map((row) =>
        row.specificationUuid === specificationUuid
          ? { ...row, ...patch, owned: true }
          : row,
      ),
    );

  const resetRow = (specificationUuid: string) =>
    setRows((current) =>
      current.map((row) => {
        const source = original.get(specificationUuid);
        return row.specificationUuid === specificationUuid && source
          ? { ...source, owned: false }
          : row;
      }),
    );

  const removeRow = (specificationUuid: string) =>
    setRows((current) =>
      current.filter((row) => row.specificationUuid !== specificationUuid),
    );

  const assigned = new Set(rows.map((row) => row.specificationUuid));
  const addable = library
    .filter((specification) => !assigned.has(specification.uuid))
    .map((specification) => ({
      value: specification.uuid,
      label: specification.unit
        ? `${specification.label} (${specification.unit})`
        : specification.label,
    }));

  const addAttribute = (specificationUuid: string) => {
    const specification = library.find(
      (item) => item.uuid === specificationUuid,
    );
    if (!specification) {
      return;
    }
    setRows((current) => [
      ...current,
      {
        specificationUuid: specification.uuid,
        key: specification.key,
        label: specification.label,
        unit: specification.unit,
        ordered: specification.ordered,
        valueType: specification.valueType,
        inputType: specification.inputType,
        allowMultiple: specification.allowMultiple,
        masterOptions: (specification.options ?? []).map(
          (option) => option.value,
        ),
        offeredOptions: (specification.options ?? []).map(
          (option) => option.value,
        ),
        sourceCategoryUuid: categoryUuid,
        sourceCategoryName: categoryName,
        inherited: false,
        // A newly assigned attribute is alive for the engine but not yet a
        // shopper-facing filter — showing it is the deliberate second step.
        isFilter: false,
        isRule: true,
        scope: "branch",
        showIf: null,
        audience: "all",
        enabledValues: null,
        order: current.length,
        owned: true,
      },
    ]);
  };

  // Show-if can only point at another attribute on this same category.
  const controllersFor = (specificationUuid: string) =>
    rows
      .filter(
        (row) =>
          row.specificationUuid !== specificationUuid &&
          row.masterOptions.length > 0,
      )
      .map((row) => ({ value: row.key, label: `only if ${row.label}` }));

  const controllerOptions = Object.fromEntries(
    rows.map((row) => [row.key, row.masterOptions]),
  );

  const onSave = () =>
    startTransition(() => {
      dispatch(rows.filter((row) => row.owned).map(toInput));
    });

  const ownedCount = rows.filter((row) => row.owned).length;

  return (
    <div className="flex flex-col gap-5 rounded-card border border-hairline bg-surface p-7 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
      <div className="flex items-center gap-3 border-b border-hairline pb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-tint text-primary">
          <Layers size={20} />
        </div>
        <div>
          <h2 className="font-heading text-xl text-ink">
            Attributes on {categoryName}
          </h2>
          <p className="text-xs text-muted">
            {rows.length} carried · {ownedCount} authored here · the rest
            inherited
          </p>
        </div>
      </div>

      <p className="rounded-control bg-primary-tint p-4 text-xs text-secondary">
        An attribute is defined once in the library and borrowed here. This page
        sets only how <span className="font-semibold">{categoryName}</span> uses
        it — never its name, type or master option list. Descendants inherit
        everything below and may override any of it.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-control border border-dashed border-hairline p-6 text-center text-sm text-faint">
          This category carries no attributes yet. Assign one from the library
          below.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <AssignmentRow
              key={row.specificationUuid}
              row={row}
              controllers={controllersFor(row.specificationUuid)}
              controllerOptions={controllerOptions}
              onChange={patchRow}
              onReset={resetRow}
              onRemove={removeRow}
            />
          ))}
        </ul>
      )}

      <div className="w-72">
        <Dropdown
          searchable
          value=""
          onChange={addAttribute}
          placeholder="Assign attribute from library…"
          searchPlaceholder="Search the library…"
          options={addable}
        />
      </div>

      <FormError message={state.error} />
      {state.success && (
        <p className="text-xs font-semibold text-primary">Assignments saved.</p>
      )}

      <div className="flex justify-end border-t border-hairline pt-5">
        <Button type="button" onClick={onSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save assignments"}
        </Button>
      </div>
    </div>
  );
};
