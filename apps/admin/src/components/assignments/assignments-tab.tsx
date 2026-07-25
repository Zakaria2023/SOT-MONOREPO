"use client";

import type { SpecificationWithCategories } from "@/app/(dashboard)/assignments/actions";
import type { DraftRow } from "@/components/assignments/assignment-workspace";
import { RelationSection } from "@/components/assignments/relation-section";
import type { SpecRelation } from "@/app/(dashboard)/assignments/actions";
import type { AssignmentAudience, AssignmentScope } from "@/db/enum";
import { ArrowUpFromLine, Eye, EyeOff, X, Zap, ZapOff } from "lucide-react";
import type { ReactNode } from "react";
import { Dropdown } from "ui";

type AssignmentsTabProps = {
  rows: DraftRow[];
  library: SpecificationWithCategories[];
  // Rules touching each assigned attribute, keyed by spec uuid.
  relations: Record<string, SpecRelation[]>;
  onChange: (specificationUuid: string, patch: Partial<DraftRow>) => void;
  onReset: (specificationUuid: string) => void;
  onRemove: (specificationUuid: string) => void;
  onAdd: (specificationUuid: string) => void;
};

type AssignmentCardProps = {
  row: DraftRow;
  relations: SpecRelation[];
  otherSpecs: { value: string; label: string }[];
  // How many other attributes this category carries at all, so an empty
  // controller list can explain itself rather than look broken.
  siblingCount: number;
  // Other attributes on this category that could gate this one.
  controllers: { value: string; label: string }[];
  controllerOptions: Record<string, string[]>;
  onChange: (specificationUuid: string, patch: Partial<DraftRow>) => void;
  onReset: (specificationUuid: string) => void;
  onRemove: (specificationUuid: string) => void;
};

type SwitchProps = {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
};

// Widest to narrowest — used to stop a category widening what the library set.
const AUDIENCE_RANK: Record<AssignmentAudience, number> = {
  all: 0,
  partner: 1,
  staff: 2,
};

const Switch = ({ active, onClick, disabled, title, children }: SwitchProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-pressed={active}
    className={
      active
        ? "flex items-center gap-1.5 rounded-control bg-primary px-3.5 py-2 text-sm font-semibold text-white"
        : "flex items-center gap-1.5 rounded-control border border-hairline bg-page px-3.5 py-2 text-sm font-medium text-faint transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hairline disabled:hover:text-faint"
    }
  >
    {children}
  </button>
);

const AssignmentCard = ({
  row,
  relations,
  otherSpecs,
  siblingCount,
  controllers,
  controllerOptions,
  onChange,
  onReset,
  onRemove,
}: AssignmentCardProps) => {
  const enabled = new Set(row.enabledValues ?? row.masterOptions);
  const hasOptions = row.masterOptions.length > 0;
  const isBoolean = row.inputType === "boolean";
  const showIfValues = row.showIf?.values ?? [];

  const toggleEnabled = (option: string) => {
    const current = new Set(row.enabledValues ?? row.masterOptions);
    if (current.has(option)) {
      current.delete(option);
    } else {
      current.add(option);
    }
    // Everything ticked means "no narrowing" — store null rather than a slice
    // equal to the master list, so the category keeps tracking options added
    // to the library later.
    const next = row.masterOptions.filter((value) => current.has(value));
    onChange(row.specificationUuid, {
      enabledValues: next.length === row.masterOptions.length ? null : next,
    });
  };

  const toggleShowIfValue = (value: string) => {
    if (!row.showIf) {
      return;
    }
    const current = new Set(showIfValues);
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    onChange(row.specificationUuid, {
      showIf: { specKey: row.showIf.specKey, values: [...current] },
    });
  };

  return (
    <li className="flex flex-col gap-2.5 rounded-control border border-hairline bg-page p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-ink">{row.label}</span>
        <span className="rounded bg-primary-tint px-1.5 py-0.5 text-xs font-semibold text-primary">
          {isBoolean ? "yes / no" : row.valueType === "number" ? "number" : "select"}
        </span>
        {hasOptions && (
          <span className="rounded bg-surface px-1.5 py-0.5 text-sm font-medium text-muted">
            {row.ordered ? "ordered · ceiling" : "unordered · inclusion"}
          </span>
        )}
        {row.inherited && !row.owned ? (
          <span className="flex items-center gap-1 text-sm font-medium text-faint">
            <ArrowUpFromLine size={15} />
            from {row.sourceCategoryName ?? "an ancestor"}
          </span>
        ) : (
          <span className="text-sm font-medium text-faint">own</span>
        )}

        <span className="ml-auto flex items-center gap-1">
          {row.owned && row.inherited && (
            <button
              type="button"
              onClick={() => onReset(row.specificationUuid)}
              className="rounded px-2 py-1 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              Reset to inherited
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(row.specificationUuid)}
            aria-label={`Remove ${row.label}`}
            className="rounded-control border border-hairline p-1.5 text-faint transition-colors hover:border-danger hover:text-danger"
          >
            <X size={14} />
          </button>
        </span>
      </div>

      {/* Switches 1 and 2, then scope. */}
      <div className="flex flex-wrap items-center gap-2">
        <Switch
          active={row.isFilter}
          onClick={() =>
            onChange(row.specificationUuid, { isFilter: !row.isFilter })
          }
        >
          {row.isFilter ? <Eye size={15} /> : <EyeOff size={15} />}
          Filter
        </Switch>
        <Switch
          active={row.isRule}
          onClick={() =>
            onChange(row.specificationUuid, { isRule: !row.isRule })
          }
        >
          {row.isRule ? <Zap size={15} /> : <ZapOff size={15} />}
          Rule
        </Switch>
        {(["branch", "leaf"] as AssignmentScope[]).map((scope) => (
          <Switch
            key={scope}
            active={row.scope === scope}
            onClick={() => onChange(row.specificationUuid, { scope })}
          >
            {scope === "branch" ? "Branch" : "Leaf"}
          </Switch>
        ))}
      </div>

      {/* Audience. The library already fixed who the attribute is FOR; this
          can only narrow it, so anything wider is shown as unavailable. */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "partner", "staff"] as AssignmentAudience[]).map(
          (audience) => {
            const widerThanDefinition =
              AUDIENCE_RANK[audience] < AUDIENCE_RANK[row.definitionAudience];
            return (
              <Switch
                key={audience}
                active={row.audience === audience && !widerThanDefinition}
                disabled={widerThanDefinition}
                title={
                  widerThanDefinition
                    ? `This attribute is ${row.definitionAudience}-only in the library — a category cannot widen that`
                    : undefined
                }
                onClick={() => onChange(row.specificationUuid, { audience })}
              >
                {audience === "all"
                  ? "All"
                  : audience === "partner"
                    ? "Partner"
                    : "Staff"}
              </Switch>
            );
          },
        )}
        {row.definitionAudience !== "all" && (
          <span className="text-sm text-faint">
            {row.definitionAudience}-only in the library
          </span>
        )}
      </div>

      {!row.isFilter && row.isRule && (
        <p className="text-sm text-faint">
          Living, not showing — the engine reads this value, no shopper sees it.
        </p>
      )}

      {hasOptions && (
        <div>
          <p className="text-sm text-muted">
            {isBoolean
              ? "Enabled values: any yes / no"
              : "Enabled values (slice of the master list):"}
          </p>
          {!isBoolean && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {row.masterOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleEnabled(option)}
                  aria-pressed={enabled.has(option)}
                  className={
                    enabled.has(option)
                      ? "rounded-md bg-primary px-2.5 py-1 text-sm font-semibold text-white"
                      : "rounded-md border border-hairline bg-surface px-2.5 py-1 text-sm text-faint"
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1 text-sm text-muted">
          <EyeOff size={14} />
          Show-if
        </span>
        {controllers.length === 0 ? (
          // An empty dropdown reads as a bug. Say which of the two reasons it
          // is: nothing else is assigned here, or what is assigned has no
          // values to test against.
          <p className="rounded-control border border-dashed border-hairline px-3 py-2 text-sm text-faint">
            {siblingCount === 0
              ? "Always shown — this is the only attribute on this category, so there is nothing to condition it on. Assign another and it can gate this one."
              : "Always shown — the other attributes here are numbers with no option list, and a condition tests against values. Assign one with options to gate this."}
          </p>
        ) : (
          <Dropdown
            value={row.showIf?.specKey ?? ""}
            onChange={(specKey) =>
              onChange(row.specificationUuid, {
                showIf: specKey ? { specKey, values: [] } : null,
              })
            }
            options={[
              { value: "", label: "— always shown —" },
              ...controllers,
            ]}
          />
        )}
        {row.showIf && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-muted">is</span>
            {(controllerOptions[row.showIf.specKey] ?? []).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleShowIfValue(value)}
                aria-pressed={showIfValues.includes(value)}
                className={
                  showIfValues.includes(value)
                    ? "rounded-md bg-primary px-2.5 py-1 text-sm font-semibold text-white"
                    : "rounded-md border border-hairline bg-surface px-2.5 py-1 text-sm text-faint"
                }
              >
                {value}
              </button>
            ))}
            {showIfValues.length === 0 && (
              <span className="text-sm text-amber-700">
                pick a value, or it is always hidden
              </span>
            )}
          </div>
        )}
      </div>

      <RelationSection
        specUuid={row.specificationUuid}
        specLabel={row.label}
        specUnit={row.unit}
        relations={relations}
        otherSpecs={otherSpecs}
      />
    </li>
  );
};

export const AssignmentsTab = ({
  rows,
  library,
  relations,
  onChange,
  onReset,
  onRemove,
  onAdd,
}: AssignmentsTabProps) => {
  const assigned = new Set(rows.map((row) => row.specificationUuid));
  const addable = library
    .filter((specification) => !assigned.has(specification.uuid))
    .map((specification) => ({
      value: specification.uuid,
      label: specification.unit
        ? `${specification.label} (${specification.unit})`
        : specification.label,
    }));

  // Show-if can only point at another attribute on this same category, and
  // only one that has values to test.
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

  // A relation can bind any attribute in the library, not only ones this
  // category carries — a camera's power draw is measured against a switch's
  // budget, and those live in different trees.
  const otherSpecsFor = (specificationUuid: string) =>
    library
      .filter((specification) => specification.uuid !== specificationUuid)
      .map((specification) => ({
        value: specification.uuid,
        label: specification.unit
          ? `${specification.label} (${specification.unit})`
          : specification.label,
      }));

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className="rounded-control border border-dashed border-hairline p-8 text-center text-sm text-faint">
          This category carries no attributes yet. Assign one from the library.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <AssignmentCard
              key={row.specificationUuid}
              row={row}
              relations={relations[row.specificationUuid] ?? []}
              otherSpecs={otherSpecsFor(row.specificationUuid)}
              siblingCount={rows.length - 1}
              controllers={controllersFor(row.specificationUuid)}
              controllerOptions={controllerOptions}
              onChange={onChange}
              onReset={onReset}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}

      <div className="w-72">
        <Dropdown
          searchable
          value=""
          onChange={onAdd}
          placeholder="Assign attribute from library…"
          searchPlaceholder="Search the library…"
          options={addable}
        />
      </div>
    </div>
  );
};
