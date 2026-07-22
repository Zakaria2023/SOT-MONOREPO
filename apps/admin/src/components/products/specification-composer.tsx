"use client";

import type { ProductFormValues } from "@/app/(dashboard)/products/validation";
import type { SpecificationDomain } from "@/db/enum";
import { specInputTypes } from "@/db/enum";
import {
  SPECIFICATION_DOMAIN_LABELS,
  SPEC_INPUT_TYPE_LABELS,
} from "@/db/label";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { LibraryDomain, SelectSpecifications } from "services";
import { Checkbox, Dropdown } from "ui";
import {
  parseSpecValues,
  resolveSpecInputType,
  serializeSpecRange,
  serializeSpecValues,
  splitSpecRange,
} from "utils";

type SpecificationComposerProps = {
  library: LibraryDomain[];
};

// A spec resolved from the library, tagged with where it sits for the picker.
type LibrarySpec = SelectSpecifications & {
  groupName: string;
  domain: string | null;
};

// A picker entry, carrying the attribute's input type so the type filter can
// narrow the list down.
type PickerOption = {
  value: string;
  label: string;
  inputType: string;
};

const TYPE_FILTER_OPTIONS = specInputTypes.map((type) => ({
  value: type,
  label: SPEC_INPUT_TYPE_LABELS[type],
}));

export const SpecificationComposer = ({
  library,
}: SpecificationComposerProps) => {
  const { control, setValue } = useFormContext<ProductFormValues>();
  const watchedKeys = useWatch({ control, name: "specKeys" });
  const watchedValues = useWatch({ control, name: "technicalAttributes" });
  const appliedKeys = useMemo(() => watchedKeys ?? [], [watchedKeys]);
  const values = useMemo(() => watchedValues ?? {}, [watchedValues]);

  // Flatten the library once: a key → spec map, and the picker options.
  const { specByKey, pickerOptions } = useMemo(() => {
    const byKey = new Map<string, LibrarySpec>();
    const options: PickerOption[] = [];
    for (const domain of library) {
      const domainLabel = domain.domain
        ? (SPECIFICATION_DOMAIN_LABELS[domain.domain as SpecificationDomain] ??
          domain.domain)
        : "Other";
      for (const group of domain.groups) {
        for (const attribute of group.attributes) {
          const spec: LibrarySpec = {
            ...attribute,
            groupName: group.group.name,
            domain: domain.domain,
          };
          byKey.set(attribute.key, spec);
          options.push({
            value: attribute.key,
            label: `${domainLabel} · ${group.group.name} · ${attribute.label}`,
            inputType: resolveSpecInputType(attribute),
          });
        }
      }
    }
    return { specByKey: byKey, pickerOptions: options };
  }, [library]);

  // Input types the picker is narrowed to. Empty = show every attribute.
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  const visibleOptions = useMemo(
    () =>
      (typeFilter.length === 0
        ? pickerOptions
        : pickerOptions.filter((option) =>
            typeFilter.includes(option.inputType),
          )
      ).map((option) => ({ value: option.value, label: option.label })),
    [pickerOptions, typeFilter],
  );

  // Keys this component auto-added because some option revealed them, so they
  // can be auto-removed when that option is un-chosen — manually-added keys
  // (never recorded here) are left alone.
  const autoAddedRef = useRef<Set<string>>(new Set());

  // The set of attribute keys the currently-chosen option values reveal.
  const revealedKeys = useMemo(() => {
    const desired = new Set<string>();
    for (const key of appliedKeys) {
      const spec = specByKey.get(key);
      if (!spec?.options) {
        continue;
      }
      const chosen = spec.allowMultiple
        ? parseSpecValues(values[key])
        : [values[key] ?? ""];
      for (const option of spec.options) {
        if (!option.reveals || !chosen.includes(option.value)) {
          continue;
        }
        for (const revealKey of option.reveals) {
          // Only reveal keys that still exist in the library.
          if (specByKey.has(revealKey)) {
            desired.add(revealKey);
          }
        }
      }
    }
    return desired;
  }, [appliedKeys, values, specByKey]);

  // Reconcile the applied keys with what the chosen options reveal: add the
  // freshly-revealed ones, drop the ones we auto-added that are no longer
  // revealed (clearing their stored value too), and leave manual keys intact.
  useEffect(() => {
    const toAdd = [...revealedKeys].filter((key) => !appliedKeys.includes(key));
    const toRemove = [...autoAddedRef.current].filter(
      (key) => !revealedKeys.has(key) && appliedKeys.includes(key),
    );

    autoAddedRef.current = new Set([
      ...[...autoAddedRef.current].filter((key) => revealedKeys.has(key)),
      ...toAdd,
    ]);

    if (toAdd.length === 0 && toRemove.length === 0) {
      return;
    }

    const nextKeys = [
      ...appliedKeys.filter((key) => !toRemove.includes(key)),
      ...toAdd,
    ];
    setValue("specKeys", nextKeys, { shouldDirty: true });

    if (toRemove.length > 0) {
      const nextValues = { ...values };
      for (const key of toRemove) {
        delete nextValues[key];
      }
      setValue("technicalAttributes", nextValues, { shouldDirty: true });
    }
  }, [revealedKeys, appliedKeys, values, setValue]);

  const removeAttribute = (key: string) => {
    setValue(
      "specKeys",
      appliedKeys.filter((applied) => applied !== key),
      { shouldDirty: true },
    );
    const next = { ...values };
    delete next[key];
    setValue("technicalAttributes", next, { shouldDirty: true });
  };

  // The picker is a multi-select over the whole library: keys stay listed and
  // highlighted once added, and toggling one off also drops its stored value.
  const setAppliedKeys = (keys: string[]) => {
    setValue("specKeys", keys, { shouldDirty: true });
    const removed = appliedKeys.filter((applied) => !keys.includes(applied));
    if (removed.length > 0) {
      const next = { ...values };
      for (const key of removed) {
        delete next[key];
      }
      setValue("technicalAttributes", next, { shouldDirty: true });
    }
  };

  const setValueFor = (key: string, value: string) => {
    const next = { ...values };
    if (value) {
      next[key] = value;
    } else {
      delete next[key];
    }
    setValue("technicalAttributes", next, { shouldDirty: true });
  };

  const toggleMulti = (key: string, option: string, checked: boolean) => {
    const current = parseSpecValues(values[key]);
    const selected = checked
      ? [...current, option]
      : current.filter((value) => value !== option);
    setValueFor(key, selected.length > 0 ? serializeSpecValues(selected) : "");
  };

  const setRange = (key: string, part: "from" | "to", value: string) => {
    const [from, to] = splitSpecRange(values[key]);
    const nextFrom = part === "from" ? value : from;
    const nextTo = part === "to" ? value : to;
    setValueFor(
      key,
      nextFrom.trim() === "" && nextTo.trim() === ""
        ? ""
        : serializeSpecRange(nextFrom, nextTo),
    );
  };

  const renderInput = (spec: LibrarySpec) => {
    const options = spec.options ?? [];
    if (spec.valueType === "number") {
      if (spec.allowRange) {
        const [from, to] = splitSpecRange(values[spec.key]);
        return (
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="any"
              value={from}
              onChange={(event) => setRange(spec.key, "from", event.target.value)}
              placeholder="From"
              className="w-full flex-1 rounded-control border border-hairline bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
            />
            <span className="text-sm text-faint">–</span>
            <div className="relative flex-1">
              <input
                type="number"
                step="any"
                value={to}
                onChange={(event) => setRange(spec.key, "to", event.target.value)}
                placeholder="To"
                className="w-full rounded-control border border-hairline bg-surface px-4 py-2.5 pr-14 text-sm text-ink outline-none focus:border-primary"
              />
              {spec.unit && (
                <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium text-faint">
                  {spec.unit}
                </span>
              )}
            </div>
          </div>
        );
      }
      return (
        <div className="relative">
          <input
            type="number"
            step="any"
            value={values[spec.key] ?? ""}
            onChange={(event) => setValueFor(spec.key, event.target.value)}
            placeholder="0"
            className="w-full rounded-control border border-hairline bg-surface px-4 py-2.5 pr-14 text-sm text-ink outline-none focus:border-primary"
          />
          {spec.unit && (
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium text-faint">
              {spec.unit}
            </span>
          )}
        </div>
      );
    }

    if (spec.allowMultiple) {
      const selected = parseSpecValues(values[spec.key]);
      return (
        <div className="flex flex-col gap-2 rounded-control border border-hairline bg-surface p-3">
          {options.length === 0 ? (
            <span className="text-sm text-faint">No options defined.</span>
          ) : (
            options.map((option) => (
              <Checkbox
                key={option.value}
                label={option.value}
                checked={selected.includes(option.value)}
                onChange={(event) =>
                  toggleMulti(spec.key, option.value, event.target.checked)
                }
              />
            ))
          )}
        </div>
      );
    }

    return (
      <Dropdown
        value={values[spec.key] ?? ""}
        onChange={(value) => setValueFor(spec.key, value)}
        placeholder="Select"
        options={[
          { value: "", label: "—" },
          ...options.map((option) => ({
            value: option.value,
            label: option.value,
          })),
        ]}
      />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-sm font-semibold text-ink">
          Technical specifications
        </label>
        <p className="mt-1 text-xs text-muted">
          Add the attributes that apply to this product from the library, then
          set each value. Only the attributes you add appear.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="sm:w-56">
          <Dropdown
            multiple
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="All types"
            options={TYPE_FILTER_OPTIONS}
          />
        </div>
        <div className="sm:max-w-md sm:flex-1">
          <Dropdown
            multiple
            searchable
            searchPlaceholder="Search the library..."
            value={appliedKeys}
            onChange={setAppliedKeys}
            placeholder="+ Add attribute"
            options={visibleOptions}
            emptyMessage="No attributes of this type"
          />
        </div>
      </div>

      {appliedKeys.length === 0 ? (
        <p className="rounded-control border border-dashed border-hairline p-4 text-sm text-faint">
          No attributes added yet. Use the picker above to add the ones that
          apply to this product.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {appliedKeys.map((key) => {
            const spec = specByKey.get(key);
            if (!spec) {
              // An applied key whose attribute is missing from the library
              // (deleted/renamed) — let the user drop it.
              return (
                <div key={key} className="flex flex-col gap-2">
                  <label className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">
                    <span className="line-clamp-1 text-faint">{key}</span>
                    <button
                      type="button"
                      onClick={() => removeAttribute(key)}
                      aria-label={`Remove ${key}`}
                      className="text-faint hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </label>
                  <p className="rounded-control border border-dashed border-hairline px-3 py-2 text-xs text-faint">
                    Attribute no longer in the library.
                  </p>
                </div>
              );
            }
            return (
              <div key={key} className="flex flex-col gap-2">
                <label className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">
                  <span className="line-clamp-1">
                    {spec.label}
                    <span className="ml-1 text-xs font-normal text-faint">
                      · {spec.groupName}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttribute(key)}
                    aria-label={`Remove ${spec.label}`}
                    className="shrink-0 text-faint hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </label>
                {renderInput(spec)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
