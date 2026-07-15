"use client";

import type { ProductFormValues } from "@/app/(dashboard)/products/validation";
import type { SelectCategories } from "@/db/schema/categories";
import type { SpecField, SpecOption, SpecRule } from "@/db/types";
import { Lock } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Dropdown } from "ui";

type SpecificationForCategory = {
  key: string;
  label: string;
  valueType: SpecField["valueType"];
  unit: SpecField["unit"];
  options: SpecOption[] | null;
  rules: SpecRule[] | null;
  categoryUuids: string[];
};

type TechnicalSpecsEditorProps = {
  categories: SelectCategories[];
  specifications: SpecificationForCategory[];
};

type TemplateField = SpecField & {
  rules: SpecRule[];
};

// Every key reachable below a field, across all of its options' subtrees.
const descendantKeys = (field: SpecField): string[] =>
  field.options.flatMap((option) =>
    option.children.flatMap((child) => [child.key, ...descendantKeys(child)]),
  );

// The category plus every ancestor — a spec on any of these applies here.
const categoryChain = (
  categories: SelectCategories[],
  categoryUuid: string,
): Set<string> => {
  const parentOf = new Map(categories.map((c) => [c.uuid, c.parentUuid]));
  const chain = new Set<string>();
  let current: string | null = categoryUuid;
  while (current && !chain.has(current)) {
    chain.add(current);
    current = parentOf.get(current) ?? null;
  }
  return chain;
};

// A clause matches when the product's chosen value for that spec is one of the
// clause's values. "all" = every clause must match; "any" = at least one.
const ruleMatches = (
  rule: SpecRule,
  values: Record<string, string>,
): boolean => {
  if (rule.clauses.length === 0) {
    return false;
  }
  const results = rule.clauses.map((clause) =>
    clause.values.includes(values[clause.specKey] ?? ""),
  );
  return rule.match === "all" ? results.every(Boolean) : results.some(Boolean);
};

// The assignments a rule implies: the target field set to the forced value,
// plus every parent option on the path to it (forcing a nested sub-field
// only makes sense with its branch selected). Null when the target/value
// doesn't exist in this field's tree.
const forcedPath = (
  field: SpecField,
  targetKey: string,
  targetValue: string,
): Record<string, string> | null => {
  if (field.key === targetKey) {
    return field.options.some((option) => option.value === targetValue)
      ? { [field.key]: targetValue }
      : null;
  }
  for (const option of field.options) {
    for (const child of option.children) {
      const below = forcedPath(child, targetKey, targetValue);
      if (below) {
        return { [field.key]: option.value, ...below };
      }
    }
  }
  return null;
};

// Flatten to the fields currently visible: each field, plus the sub-fields
// revealed by its chosen option (recursively). Rendered as a flat grid so a
// revealed sub-field sits beside its parent rather than nested under it.
const visibleFields = (
  fields: SpecField[],
  values: Record<string, string>,
): SpecField[] =>
  fields.flatMap((field) => {
    const option = field.options.find(
      (candidate) => candidate.value === (values[field.key] ?? ""),
    );
    return [field, ...(option ? visibleFields(option.children, values) : [])];
  });

export const TechnicalSpecsEditor = ({
  categories,
  specifications,
}: TechnicalSpecsEditorProps) => {
  const { control, setValue } = useFormContext<ProductFormValues>();
  const categoryUuid = useWatch({ control, name: "categoryUuid" });
  const watchedValues = useWatch({ control, name: "technicalAttributes" });
  // Stable fallback so the memo/effect deps don't churn on every render.
  const values = useMemo(() => watchedValues ?? {}, [watchedValues]);

  // Specs assigned to the selected category or any ancestor.
  const template = useMemo<TemplateField[]>(() => {
    if (!categoryUuid) {
      return [];
    }
    const chain = categoryChain(categories, categoryUuid);
    const seen = new Set<string>();
    const fields: TemplateField[] = [];
    for (const spec of specifications) {
      if (
        spec.categoryUuids.some((uuid) => chain.has(uuid)) &&
        !seen.has(spec.key)
      ) {
        seen.add(spec.key);
        fields.push({
          key: spec.key,
          label: spec.label,
          valueType: spec.valueType,
          unit: spec.unit,
          options: spec.options ?? [],
          rules: spec.rules ?? [],
        });
      }
    }
    return fields;
  }, [categoryUuid, categories, specifications]);

  // Keys currently forced by a matching rule, with their forced values. A
  // rule may target the spec itself or a nested sub-field — in the latter
  // case every parent option on the path is forced too, so the sub-field is
  // actually visible. First matching rule per spec wins.
  const forcedByKey = useMemo(() => {
    const forced: Record<string, string> = {};
    for (const field of template) {
      const rule = field.rules.find((candidate) =>
        ruleMatches(candidate, values),
      );
      if (!rule) {
        continue;
      }
      const path = forcedPath(
        field,
        rule.forcedKey ?? field.key,
        rule.forcedValue,
      );
      if (!path) {
        continue;
      }
      for (const [key, value] of Object.entries(path)) {
        if (!(key in forced)) {
          forced[key] = value;
        }
      }
    }
    return forced;
  }, [template, values]);

  // Apply forced values to the form whenever they change. Pruning the host
  // field's descendants first keeps stale sub-values from a previous choice
  // out of the map before the forced path is written back.
  useEffect(() => {
    let changed = false;
    const next = { ...values };
    for (const field of template) {
      const treeKeys = [field.key, ...descendantKeys(field)];
      const entries = treeKeys
        .filter((key) => key in forcedByKey)
        .map((key) => [key, forcedByKey[key]] as const);
      if (entries.length === 0) {
        continue;
      }
      if (entries.every(([key, value]) => next[key] === value)) {
        continue;
      }
      for (const key of descendantKeys(field)) {
        delete next[key];
      }
      for (const [key, value] of entries) {
        next[key] = value;
      }
      changed = true;
    }
    if (changed) {
      setValue("technicalAttributes", next, { shouldDirty: true });
    }
  }, [forcedByKey, template, values, setValue]);

  const visible = visibleFields(template, values);

  // Set a field's value and drop any sub-values that its previous option
  // revealed — a changed parent choice invalidates everything under it.
  const handleChange = (field: SpecField, value: string) => {
    const next = { ...values };
    for (const key of descendantKeys(field)) {
      delete next[key];
    }
    if (value) {
      next[field.key] = value;
    } else {
      delete next[field.key];
    }
    setValue("technicalAttributes", next, { shouldDirty: true });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-sm font-semibold text-ink">
          Technical specifications
        </label>
        <p className="mt-1 text-xs text-muted">
          Dropdown-only, from the specifications assigned to this category (and
          its parents). Selecting an option can reveal follow-up fields; rules
          may auto-set and lock a field based on other choices.
        </p>
      </div>

      {template.length === 0 ? (
        <p className="rounded-control border border-dashed border-hairline p-4 text-sm text-faint">
          No specifications apply to this category yet. Assign specifications to
          it (or a parent category) to fill them here.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((field) => {
            const forced = forcedByKey[field.key];

            return (
              <div key={field.key} className="flex flex-col gap-2">
                <label className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  {field.label}
                  {forced && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary">
                      <Lock size={11} />
                      Set by rule
                    </span>
                  )}
                </label>
                {forced ? (
                  <div className="flex items-center justify-between rounded-control border border-hairline bg-page px-4 py-2.5 text-sm text-faint">
                    {forced}
                    <Lock size={14} />
                  </div>
                ) : field.valueType === "number" ? (
                  field.options.length > 0 ? (
                    // Fixed numeric choices — picked, not typed, so no typos
                    // can reach the rule engine.
                    <Dropdown
                      value={values[field.key] ?? ""}
                      onChange={(value) => handleChange(field, value)}
                      placeholder="Select"
                      options={[
                        { value: "", label: "—" },
                        ...field.options.map((option) => ({
                          value: option.value,
                          label: field.unit
                            ? `${option.value} ${field.unit}`
                            : option.value,
                        })),
                      ]}
                    />
                  ) : (
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={values[field.key] ?? ""}
                        onChange={(event) =>
                          handleChange(field, event.target.value)
                        }
                        placeholder="0"
                        className="w-full rounded-control border border-hairline bg-surface px-4 py-2.5 pr-14 text-sm text-ink outline-none focus:border-primary"
                      />
                      {field.unit && (
                        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium text-faint">
                          {field.unit}
                        </span>
                      )}
                    </div>
                  )
                ) : (
                  <Dropdown
                    value={values[field.key] ?? ""}
                    onChange={(value) => handleChange(field, value)}
                    placeholder="Select"
                    options={[
                      { value: "", label: "—" },
                      ...field.options.map((option) => ({
                        value: option.value,
                        label: option.value,
                      })),
                    ]}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
