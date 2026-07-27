"use client";

import type { ProductFormValues } from "@/app/(dashboard)/products/validation";
import { Field } from "@/components/shared/field";
import type { SpecificationType } from "@/db/enum";
import type { ProductValue, SpecOption } from "@/db/types";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Dropdown, Input, type DropdownOption } from "ui";

// ---------------------------------------------------------------------------
// The product's specifications.
//
// Pick the specifications this product has from a dropdown, then set each value.
// A label and one control per specification, and the control follows the type:
// one choice for a single-select, several for a multi-select, Yes/No for a
// boolean, a number box for a number.
//
// A field whose reveal condition is met appears on its own — set PoE to Yes and
// PoE Budget shows up without being picked, and goes again when PoE changes.
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

// Sentinel for the ungrouped section, since a dropdown option value is a string.
const UNGROUPED = "__ungrouped__";

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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{field.label}</span>
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
              event.target.value === ""
                ? undefined
                : Number(event.target.value),
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
        <Dropdown
          multiple
          value={selected}
          onChange={(next) => onChange(next.length === 0 ? undefined : next)}
          options={live.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          placeholder="Not set"
          searchable={live.length > 8}
          emptyMessage="This category offers no options here"
        />
      )}
    </div>
  );
};

export const SpecificationComposer = ({
  fieldsByCategory,
}: SpecificationComposerProps) => {
  const { control, setValue } = useFormContext<ProductFormValues>();
  const categoryUuid = useWatch({ control, name: "categoryUuid" });
  // Memoised because the `?? {}` fallback would otherwise be a fresh object on
  // every render, re-running every memo below it each time.
  const watchedValues = useWatch({ control, name: "specValues" });
  const specValues = useMemo(() => watchedValues ?? {}, [watchedValues]);

  const [groupFilter, setGroupFilter] = useState<string[]>([]);

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

  // Every group the category carries, for the filter. Built from all fields, not
  // just the shown ones, so a group stays selectable before anything in it has
  // been added.
  const groupOptions = useMemo<DropdownOption[]>(() => {
    const seen = new Map<string, number>();
    for (const field of fields) {
      const key = field.groupName ?? UNGROUPED;
      seen.set(key, Math.min(seen.get(key) ?? Infinity, field.groupOrder));
    }
    return [...seen.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([key]) => ({
        value: key,
        label: key === UNGROUPED ? "Other" : key,
      }));
  }, [fields]);

  // An empty filter means every group. Held as a Set so the memos below depend on
  // a value rather than on a function that would be rebuilt every render.
  const allowedGroups = useMemo(
    () => (groupFilter.length === 0 ? null : new Set(groupFilter)),
    [groupFilter],
  );

  // The picker lists what the category carries, minus what is already on the
  // form, narrowed to the chosen groups.
  const options = useMemo<DropdownOption[]>(
    () =>
      fields
        .filter(
          (field) =>
            !shownUuids.has(field.specificationUuid) &&
            (allowedGroups === null ||
              allowedGroups.has(field.groupName ?? UNGROUPED)),
        )
        .map((field) => ({
          value: field.specificationUuid,
          label: field.label,
        })),
    [fields, shownUuids, allowedGroups],
  );

  // One flat list, ordered by the library's group order so related fields still
  // sit together — without a heading or a rule line between them.
  const rows = useMemo(
    () =>
      shown
        .filter(
          (field) =>
            allowedGroups === null ||
            allowedGroups.has(field.groupName ?? UNGROUPED),
        )
        .sort((a, b) => a.groupOrder - b.groupOrder),
    [shown, allowedGroups],
  );

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
        This category has no specifications yet. Add them in Assignments and
        they become available here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Groups">
          <Dropdown
            multiple
            value={groupFilter}
            onChange={setGroupFilter}
            options={groupOptions}
            searchable={groupOptions.length > 8}
            placeholder="All groups"
          />
        </Field>

        <Field label="Add specifications">
          <Dropdown
            multiple
            value={[]}
            onChange={add}
            options={options}
            searchable
            placeholder={
              options.length === 0
                ? "Nothing left to add"
                : "Pick specifications to fill in"
            }
            emptyMessage="Nothing left to add"
          />
        </Field>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-hairline px-3 py-6 text-center text-xs text-faint">
          Nothing added yet. Pick a specification above to start.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((field) => (
            <FieldRow
              key={field.specificationUuid}
              field={field}
              value={specValues[field.specificationUuid]}
              onChange={(next) => update(field.specificationUuid, next)}
              // A conditional field leaves on its own when its trigger changes,
              // so it carries no remove button.
              onRemove={
                field.showIf ? undefined : () => remove(field.specificationUuid)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
