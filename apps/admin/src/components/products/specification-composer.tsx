"use client";

import type { ProductFormValues } from "@/app/(dashboard)/products/validation";
import { Field } from "@/components/shared/field";
import type { SpecificationType } from "@/db/enum";
import type { ProductValue, SpecOption } from "@/db/types";
import { EyeOff, Hash, ListChecks, ToggleLeft, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Dropdown, Input, type DropdownOption } from "ui";

// ---------------------------------------------------------------------------
// The product's specifications.
//
// Pick the specifications this product has from a dropdown, then fill in the
// values. Fields grouped the way the library is, and a field whose reveal
// condition is met appears on its own — set PoE to Yes and PoE Budget shows up
// without being picked.
//
// No rules are defined here and none are explained here. Which specifications a
// category offers comes from Assignments; what the values then mean to the
// compatibility engine is worked out in the cart. This form only records values.
// ---------------------------------------------------------------------------

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
  // Serialised reveal condition, evaluated here so the form responds instantly.
  showIf: RevealCondition | null;
  groupName: string | null;
  groupOrder: number;
};

// A deliberately narrow mirror of the server condition: enough to drive the
// form, and nothing that could grow into a second rule language. Anything more
// complex simply shows the field and the server decides on save.
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
  // Absent for a field the reveal brought in — it disappears on its own when the
  // condition stops holding, so removing it by hand would be a dead end.
  onRemove?: () => void;
  onChange: (next: ProductValue | undefined) => void;
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

const hasValue = (value: ProductValue | undefined): boolean => {
  if (value === undefined || value === null || value === "") {
    return false;
  }
  return !(Array.isArray(value) && value.length === 0);
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

const FieldRow = ({ field, value, onChange, onRemove }: FieldRowProps) => {
  const live = field.options.filter((option) => !option.retired);
  const selected = asList(value);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <div className="mt-0.5">
          <TypeIcon type={field.type} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{field.label}</span>
            {field.unit && (
              <span className="text-xs text-faint">({field.unit})</span>
            )}
            {field.showIf && (
              <span
                title="Shown because another specification's value brought it in"
                className="flex items-center gap-1 text-[10px] text-faint"
              >
                <EyeOff size={9} />
                conditional
              </span>
            )}
          </div>
          {field.description && (
            <p className="mt-0.5 text-[11px] text-muted">{field.description}</p>
          )}
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${field.label}`}
            className="shrink-0 rounded-control p-1 text-faint hover:bg-hover hover:text-red-400"
          >
            <X size={13} />
          </button>
        )}
      </div>

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
          onChange={(next) =>
            onChange(next === "" ? undefined : next === "true")
          }
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
              This category offers no options for this specification.
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
    </div>
  );
};

export const SpecificationComposer = ({
  fieldsByCategory,
}: SpecificationComposerProps) => {
  const { control, setValue } = useFormContext<ProductFormValues>();
  const categoryUuid = useWatch({ control, name: "categoryUuid" });
  const specValues = useWatch({ control, name: "specValues" }) ?? {};

  // Specifications picked in this session that have no value yet. A field with a
  // value needs no separate record of being picked — the value IS the record,
  // which is why nothing extra is stored on the product.
  const [added, setAdded] = useState<string[]>([]);

  const fields = useMemo(
    () => fieldsByCategory[categoryUuid] ?? [],
    [fieldsByCategory, categoryUuid],
  );

  const picked = useMemo(() => {
    const set = new Set(added);
    for (const field of fields) {
      if (hasValue(specValues[field.specificationUuid])) {
        set.add(field.specificationUuid);
      }
    }
    return set;
  }, [added, fields, specValues]);

  // What is on the form: everything picked, plus anything a reveal condition has
  // brought in. Run to a fixed point, so hiding a trigger also hides whatever it
  // revealed rather than leaving an orphan behind.
  const shown = useMemo(() => {
    let current = fields.filter(
      (field) =>
        picked.has(field.specificationUuid) ||
        (field.showIf !== null && satisfied(field.showIf, specValues)),
    );
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
  }, [fields, picked, specValues]);

  const shownUuids = useMemo(
    () => new Set(shown.map((field) => field.specificationUuid)),
    [shown],
  );

  // The picker lists everything the category carries that is not already on the
  // form, labelled with its group so the list stays navigable.
  const options = useMemo<DropdownOption[]>(
    () =>
      fields
        .filter((field) => !shownUuids.has(field.specificationUuid))
        .map((field) => ({
          value: field.specificationUuid,
          label: field.groupName
            ? `${field.groupName} · ${field.label}`
            : field.label,
        })),
    [fields, shownUuids],
  );

  // Sections in the library's own group order; ungrouped fields trail behind.
  const sections = useMemo(() => {
    const byGroup = new Map<string | null, FormField[]>();
    for (const field of shown) {
      const list = byGroup.get(field.groupName) ?? [];
      list.push(field);
      byGroup.set(field.groupName, list);
    }
    return [...byGroup.entries()]
      .map(([name, groupFields]) => ({
        name,
        fields: groupFields,
        order: Math.min(...groupFields.map((field) => field.groupOrder)),
      }))
      .sort((a, b) => a.order - b.order);
  }, [shown]);

  const writeValues = (next: Record<string, ProductValue>): void => {
    setValue("specValues", next, { shouldDirty: true });
  };

  const update = (uuid: string, next: ProductValue | undefined): void => {
    const values = { ...specValues };
    if (next === undefined) {
      delete values[uuid];
    } else {
      values[uuid] = next;
    }

    // Drop the value of anything this change has just hidden. The server does it
    // again on save — a value left on a hidden field would still be read later,
    // and nobody could see the number doing it.
    const stillShown = new Set<string>();
    let current = fields.filter(
      (field) =>
        picked.has(field.specificationUuid) ||
        (field.showIf !== null && satisfied(field.showIf, values)),
    );
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
    current.forEach((field) => stillShown.add(field.specificationUuid));

    const carried = new Set(fields.map((field) => field.specificationUuid));
    for (const key of Object.keys(values)) {
      if (carried.has(key) && !stillShown.has(key)) {
        delete values[key];
      }
    }
    writeValues(values);
  };

  const add = (uuids: string[]): void => {
    setAdded((current) => [...new Set([...current, ...uuids])]);
  };

  const remove = (uuid: string): void => {
    setAdded((current) => current.filter((entry) => entry !== uuid));
    const values = { ...specValues };
    delete values[uuid];
    writeValues(values);
  };

  if (!categoryUuid) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-3 py-6 text-center text-xs text-faint">
        Pick a category first — it decides which specifications are available.
      </p>
    );
  }

  if (fields.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-3 py-6 text-center text-xs text-faint">
        This category has no specifications yet. Add them in Assignments and they
        become available here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="max-w-md">
        <Field label="Add specifications">
          <Dropdown
            multiple
            value={[]}
            onChange={add}
            options={options}
            searchable
            placeholder={
              options.length === 0
                ? "All of them are on the form"
                : "Pick specifications to fill in"
            }
            emptyMessage="Nothing left to add"
          />
        </Field>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-card border border-dashed border-hairline px-3 py-6 text-center text-xs text-faint">
          Nothing added yet. Pick a specification above to start.
        </p>
      ) : (
        sections.map((section) => (
          <section
            key={section.name ?? "ungrouped"}
            className="flex flex-col gap-3"
          >
            <h3 className="border-b border-hairline pb-1 text-xs font-semibold tracking-wide text-secondary uppercase">
              {section.name ?? "Other"}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {section.fields.map((field) => (
                <FieldRow
                  key={field.specificationUuid}
                  field={field}
                  value={specValues[field.specificationUuid]}
                  onChange={(next) => update(field.specificationUuid, next)}
                  // A conditional field leaves on its own when its trigger
                  // changes, so it carries no remove button.
                  onRemove={
                    field.showIf
                      ? undefined
                      : () => remove(field.specificationUuid)
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
};
