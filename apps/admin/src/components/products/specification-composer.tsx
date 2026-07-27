"use client";

import type { ProductFormValues } from "@/app/(dashboard)/products/validation";
import type { SpecificationType } from "@/db/enum";
import type { ProductValue, SpecOption } from "@/db/types";
import { AlertCircle, EyeOff, Hash, ListChecks, ToggleLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Dropdown, Input } from "ui";

// ---------------------------------------------------------------------------
// The product's attribute values.
//
// WHICH fields appear is not a choice made here — it is resolved from the
// category's assignment chain, so adding an attribute to a category immediately
// applies to every product in it. This component only fills the values in.
//
// It mirrors the server's reveal logic so the form is responsive, but the server
// re-runs it on save: the visible set and the clearing of hidden values are the
// authority there, not here.
// ---------------------------------------------------------------------------

// The resolved assignment, flattened for the client. Shaped by the page, which
// reads it from the same resolver the engine uses.
export type FormField = {
  specificationUuid: string;
  label: string;
  description: string | null;
  type: SpecificationType;
  unit: string | null;
  ordered: boolean;
  // The slice this category offers — not the whole master list.
  options: SpecOption[];
  isRule: boolean;
  isFilter: boolean;
  inherited: boolean;
  // Serialised reveal condition, evaluated client-side for responsiveness.
  showIf: RevealCondition | null;
  // Filing only — which section this field appears under. It never affects which
  // fields appear or what the engine reads.
  groupName: string | null;
  groupOrder: number;
};

// A deliberately narrow mirror of the server predicate: enough to drive the
// form, and nothing that could drift into a second rule language. Anything more
// complex simply shows the field, and the server decides on save.
export type RevealCondition = {
  attr: string;
  op: "equals" | "in" | "exists" | "gte" | "lte" | "gt" | "lt";
  values: (string | number | boolean)[];
};

type SpecificationComposerProps = {
  fieldsByCategory: Record<string, FormField[]>;
};

type FieldRowProps = {
  field: FormField;
  value: ProductValue | undefined;
  onChange: (next: ProductValue | undefined) => void;
  missing: boolean;
};

const TypeIcon = ({ type }: { type: SpecificationType }) => {
  if (type === "number") {
    return <Hash size={13} className="text-faint" />;
  }
  if (type === "boolean") {
    return <ToggleLeft size={13} className="text-faint" />;
  }
  return <ListChecks size={13} className="text-faint" />;
};

const asList = (value: ProductValue | undefined): string[] => {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return Array.isArray(value) ? value.map(String) : [String(value)];
};

const satisfied = (
  condition: RevealCondition | null,
  values: Record<string, ProductValue | undefined>,
): boolean => {
  if (!condition) {
    return true;
  }
  const raw = values[condition.attr];
  const list = asList(raw);
  if (list.length === 0) {
    return false;
  }
  if (condition.op === "exists") {
    return true;
  }
  if (condition.op === "equals") {
    return list.length === 1 && String(condition.values[0]) === list[0];
  }
  if (condition.op === "in") {
    const wanted = new Set(condition.values.map(String));
    return list.some((entry) => wanted.has(entry));
  }
  const numeric = Number(raw);
  const target = Number(condition.values[0]);
  if (!Number.isFinite(numeric) || !Number.isFinite(target)) {
    return false;
  }
  if (condition.op === "gte") {
    return numeric >= target;
  }
  if (condition.op === "lte") {
    return numeric <= target;
  }
  if (condition.op === "gt") {
    return numeric > target;
  }
  return numeric < target;
};

const FieldRow = ({ field, value, onChange, missing }: FieldRowProps) => {
  const live = field.options.filter((option) => !option.retired);
  const selected = asList(value);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <TypeIcon type={field.type} />
        <span className="text-xs font-medium text-secondary">{field.label}</span>
        {field.isRule && (
          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
            required — the engine reads this
          </span>
        )}
        {!field.isFilter && field.isRule && (
          <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
            living
          </span>
        )}
        {field.showIf && (
          <span className="flex items-center gap-1 text-[10px] text-faint">
            <EyeOff size={9} />
            conditional
          </span>
        )}
      </div>

      {field.description && (
        <p className="text-[11px] text-muted">{field.description}</p>
      )}

      {field.type === "number" && (
        <Input
          type="number"
          value={value === undefined ? "" : String(value)}
          onChange={(event) =>
            onChange(
              event.target.value === "" ? undefined : Number(event.target.value),
            )
          }
          rightSlot={
            field.unit ? (
              <span className="text-xs text-faint">{field.unit}</span>
            ) : undefined
          }
        />
      )}

      {field.type === "boolean" && (
        <Dropdown
          value={value === undefined ? "" : value === true ? "true" : "false"}
          onChange={(next) => onChange(next === "" ? undefined : next === "true")}
          options={[
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ]}
          placeholder="Not set"
        />
      )}

      {field.type === "single_select" && (
        <Dropdown
          value={selected[0] ?? ""}
          onChange={(next) => onChange(next === "" ? undefined : next)}
          options={live.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          placeholder="Not set"
          searchable={live.length > 8}
        />
      )}

      {field.type === "multi_select" && (
        <div className="flex flex-wrap gap-1.5">
          {live.length === 0 && (
            <span className="text-[11px] text-faint">
              This category offers no options for this attribute.
            </span>
          )}
          {live.map((option) => {
            const picked = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  const next = picked
                    ? selected.filter((entry) => entry !== option.value)
                    : [...selected, option.value];
                  onChange(next.length === 0 ? undefined : next);
                }}
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  picked
                    ? "bg-primary/20 text-primary"
                    : "bg-hover text-secondary hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {missing && (
        <p className="flex items-center gap-1 text-[11px] text-amber-500">
          <AlertCircle size={11} />
          Needed before this product can be sold — a blank here would make it
          silently pass every rule that reads this.
        </p>
      )}
    </div>
  );
};

export const SpecificationComposer = ({
  fieldsByCategory,
}: SpecificationComposerProps) => {
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const { control, setValue } = useFormContext<ProductFormValues>();
  const categoryUuid = useWatch({ control, name: "categoryUuid" });
  const specValues = useWatch({ control, name: "specValues" }) ?? {};

  const fields = useMemo(
    () => fieldsByCategory[categoryUuid] ?? [],
    [fieldsByCategory, categoryUuid],
  );

  // The reveal, run to a fixed point: hiding a trigger has to hide whatever it
  // revealed, or a field lingers because its own condition still matches a value
  // nobody can see any more.
  const visible = useMemo(() => {
    let current = fields;
    for (let pass = 0; pass <= fields.length; pass += 1) {
      const present = new Set(current.map((field) => field.specificationUuid));
      const next = current.filter(
        (field) =>
          !field.showIf ||
          (present.has(field.showIf.attr) &&
            satisfied(field.showIf, specValues)),
      );
      if (next.length === current.length) {
        return next;
      }
      current = next;
    }
    return current;
  }, [fields, specValues]);

  const missing = useMemo(
    () =>
      new Set(
        visible
          .filter((field) => {
            if (!field.isRule) {
              return false;
            }
            const value = specValues[field.specificationUuid];
            if (value === undefined || value === null || value === "") {
              return true;
            }
            return Array.isArray(value) && value.length === 0;
          })
          .map((field) => field.specificationUuid),
      ),
    [visible, specValues],
  );

  // Sections follow the library's own group order, so the form reads the way the
  // library is arranged. Ungrouped fields trail behind under "Other".
  const sections = useMemo(() => {
    const byGroup = new Map<string | null, FormField[]>();
    for (const field of visible) {
      const list = byGroup.get(field.groupName) ?? [];
      list.push(field);
      byGroup.set(field.groupName, list);
    }
    return [...byGroup.entries()]
      .map(([name, groupFields]) => ({
        name,
        fields: groupFields,
        order: Math.min(...groupFields.map((field) => field.groupOrder)),
        missing: groupFields.filter((field) =>
          missing.has(field.specificationUuid),
        ).length,
      }))
      .sort((a, b) => a.order - b.order);
  }, [visible, missing]);

  const shownSections =
    groupFilter === null
      ? sections
      : sections.filter((section) => section.name === groupFilter);

  // Values still needed that the filter is currently hiding. Without this, an
  // author could filter to one group, see no warnings, and save an incomplete
  // product — and an incomplete product silently passes every rule that reads it.
  const hiddenMissing = sections
    .filter((section) => !shownSections.includes(section))
    .reduce((sum, section) => sum + section.missing, 0);

  const update = (uuid: string, next: ProductValue | undefined): void => {
    const values = { ...specValues };
    if (next === undefined) {
      delete values[uuid];
    } else {
      values[uuid] = next;
    }
    // Drop the values of anything the change has just hidden. The server does
    // this again on save — a leftover value on a hidden field would still be
    // feeding the engine, and nobody would be able to see the number doing it.
    const stillVisible = new Set<string>();
    let current = fields;
    for (let pass = 0; pass <= fields.length; pass += 1) {
      const present = new Set(current.map((field) => field.specificationUuid));
      const filtered = current.filter(
        (field) =>
          !field.showIf ||
          (present.has(field.showIf.attr) && satisfied(field.showIf, values)),
      );
      if (filtered.length === current.length) {
        current = filtered;
        break;
      }
      current = filtered;
    }
    current.forEach((field) => stillVisible.add(field.specificationUuid));

    const assigned = new Set(fields.map((field) => field.specificationUuid));
    for (const key of Object.keys(values)) {
      if (assigned.has(key) && !stillVisible.has(key)) {
        delete values[key];
      }
    }

    setValue("specValues", values, { shouldDirty: true });
  };

  if (!categoryUuid) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-3 py-6 text-center text-xs text-faint">
        Pick a category first — it decides which specifications this product
        carries.
      </p>
    );
  }

  if (fields.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-3 py-6 text-center text-xs text-faint">
        This category has no attributes assigned yet. Add them in Assignments and
        they will appear here for every product in the category.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {missing.size > 0 && (
        <p className="rounded-card border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
          {missing.size} value{missing.size === 1 ? "" : "s"} still needed before
          this product can be sold
          {hiddenMissing > 0 && (
            <span>
              {" "}
              — {hiddenMissing} of them in a group this filter is hiding
            </span>
          )}
          .
        </p>
      )}

      {/* A filter, not a picker. It narrows what is ON SCREEN; the category still
          decides which fields exist, so nothing here changes the product. */}
      {sections.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setGroupFilter(null)}
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              groupFilter === null
                ? "bg-primary/20 text-primary"
                : "bg-hover text-secondary hover:text-ink"
            }`}
          >
            All
          </button>
          {sections.map((section) => {
            const short = section.missing > 0;
            return (
              <button
                key={section.name ?? "ungrouped"}
                type="button"
                onClick={() => setGroupFilter(section.name)}
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  groupFilter === section.name
                    ? "bg-primary/20 text-primary"
                    : "bg-hover text-secondary hover:text-ink"
                }`}
              >
                {section.name ?? "Other"}
                {short && (
                  <span className="ml-1 text-amber-500">{section.missing}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {shownSections.map((section) => (
        <section
          key={section.name ?? "ungrouped"}
          className="flex flex-col gap-3"
        >
          <h3 className="border-b border-hairline pb-1 text-xs font-semibold tracking-wide text-secondary uppercase">
            {section.name ?? "Other"}
            {section.missing > 0 && (
              <span className="ml-2 font-normal text-amber-500">
                {section.missing} needed
              </span>
            )}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {section.fields.map((field) => (
              <FieldRow
                key={field.specificationUuid}
                field={field}
                value={specValues[field.specificationUuid]}
                onChange={(next) => update(field.specificationUuid, next)}
                missing={missing.has(field.specificationUuid)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
