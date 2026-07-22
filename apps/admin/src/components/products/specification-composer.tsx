"use client";

import type { ProductFormValues } from "@/app/(dashboard)/products/validation";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { SelectCategories } from "@/db/schema/categories";
import { categoryWithAncestors } from "@/lib/categories";
import type { LibraryDomain, LibrarySpecification } from "services";
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
  categories: SelectCategories[];
};

// A spec resolved from the library, tagged with where it sits for the picker.
type LibrarySpec = LibrarySpecification & {
  groupName: string;
  domain: string | null;
};

// A picker entry. The label is just the attribute name — the group is a filter
// rather than a prefix on every row — and the rest is what the filters match on.
type PickerOption = {
  value: string;
  label: string;
  groupUuid: string;
  categoryUuids: string[];
};

export const SpecificationComposer = ({
  library,
  categories,
}: SpecificationComposerProps) => {
  const { control, setValue } = useFormContext<ProductFormValues>();
  const watchedKeys = useWatch({ control, name: "specKeys" });
  const watchedValues = useWatch({ control, name: "technicalAttributes" });
  const categoryUuid = useWatch({ control, name: "categoryUuid" });
  const appliedKeys = useMemo(() => watchedKeys ?? [], [watchedKeys]);
  const values = useMemo(() => watchedValues ?? {}, [watchedValues]);

  // Flatten the library once: a key → spec map, the picker options, and the
  // groups that actually hold attributes (the group filter's choices).
  const { specByKey, pickerOptions, groupFilterOptions } = useMemo(() => {
    const byKey = new Map<string, LibrarySpec>();
    const options: PickerOption[] = [];
    const groupChoices: { value: string; label: string }[] = [];
    for (const domain of library) {
      for (const group of domain.groups) {
        if (group.attributes.length > 0) {
          groupChoices.push({
            value: group.group.uuid,
            label: group.group.name,
          });
        }
        for (const attribute of group.attributes) {
          const spec: LibrarySpec = {
            ...attribute,
            groupName: group.group.name,
            domain: domain.domain,
          };
          byKey.set(attribute.key, spec);
          options.push({
            value: attribute.key,
            label: attribute.label,
            groupUuid: group.group.uuid,
            categoryUuids: attribute.categoryUuids,
          });
        }
      }
    }
    return {
      specByKey: byKey,
      pickerOptions: options,
      groupFilterOptions: groupChoices,
    };
  }, [library]);

  // Groups the picker is narrowed to. Empty = show every attribute.
  const [groupFilter, setGroupFilter] = useState<string[]>([]);

  // The chosen category plus its ancestors — an attribute assigned to any of
  // them applies here, matching how category inheritance is resolved.
  const categoryChain = useMemo(
    () =>
      categoryUuid ? new Set(categoryWithAncestors(categoryUuid, categories)) : null,
    [categoryUuid, categories],
  );

  const visibleOptions = useMemo(
    () =>
      pickerOptions
        .filter((option) => {
          if (
            groupFilter.length > 0 &&
            !groupFilter.includes(option.groupUuid)
          ) {
            return false;
          }
          // An attribute with no categories is universal. One with categories
          // shows only when the product's category (or an ancestor) matches.
          if (option.categoryUuids.length === 0 || !categoryChain) {
            return true;
          }
          return option.categoryUuids.some((uuid) => categoryChain.has(uuid));
        })
        .map((option) => ({ value: option.value, label: option.label })),
    [pickerOptions, groupFilter, categoryChain],
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

  // The label of the attribute + option currently revealing `key`, or null if
  // nothing does. Drives the "auto" chip and the disabled remove button.
  const revealSourceOf = (key: string): string | null => {
    if (!revealedKeys.has(key)) {
      return null;
    }
    for (const appliedKey of appliedKeys) {
      const spec = specByKey.get(appliedKey);
      if (!spec?.options) {
        continue;
      }
      const chosen = spec.allowMultiple
        ? parseSpecValues(values[appliedKey])
        : [values[appliedKey] ?? ""];
      for (const option of spec.options) {
        if (option.reveals?.includes(key) && chosen.includes(option.value)) {
          return `${spec.label} = ${option.value}`;
        }
      }
    }
    return null;
  };

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

    // A free-text attribute is stored as a select with no options, so without
    // this branch it would render as a dropdown containing only "—".
    if (resolveSpecInputType(spec) === "text") {
      return (
        <input
          type="text"
          value={values[spec.key] ?? ""}
          onChange={(event) => setValueFor(spec.key, event.target.value)}
          placeholder="Type a value"
          className="w-full rounded-control border border-hairline bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
        />
      );
    }

    // A select with nothing to choose from is a library gap, not a value the
    // admin can fill — say so instead of showing an empty dropdown.
    if (options.length === 0) {
      return (
        <p className="rounded-control border border-dashed border-hairline px-3 py-2.5 text-xs text-faint">
          No options defined for this attribute in the library.
        </p>
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
          set each value. The picker shows attributes assigned to this
          product&apos;s category (plus the ones that apply everywhere).
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="sm:w-80">
          <Dropdown
            multiple
            searchable
            value={groupFilter}
            onChange={setGroupFilter}
            placeholder="All groups"
            searchPlaceholder="Search groups…"
            options={groupFilterOptions}
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
            triggerLabel="+ Add attribute"
            options={visibleOptions}
            emptyMessage="No attributes match these filters"
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
            // Revealed by another attribute's chosen option — removing it here
            // would only bring it straight back, so the remove button is
            // disabled and the source is named instead.
            const revealedBy = revealSourceOf(key);
            return (
              <div key={key} className="flex flex-col gap-2">
                <label className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">
                  <span className="line-clamp-1">
                    {spec.label}
                    <span className="ml-1 text-xs font-normal text-faint">
                      · {spec.groupName}
                    </span>
                    {revealedBy && (
                      <span
                        title={`Added automatically by ${revealedBy}`}
                        className="ml-1.5 rounded bg-primary-tint px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                      >
                        auto
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttribute(key)}
                    disabled={Boolean(revealedBy)}
                    title={
                      revealedBy
                        ? `Required by ${revealedBy} — change that value to remove this`
                        : undefined
                    }
                    aria-label={`Remove ${spec.label}`}
                    className="shrink-0 text-faint hover:text-danger disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-faint"
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
