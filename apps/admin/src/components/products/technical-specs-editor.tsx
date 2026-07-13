"use client";

import type { ProductFormValues } from "@/app/(dashboard)/products/validation";
import type { SelectCategories } from "@/db/schema/categories";
import type { SpecField, SpecOption } from "@/db/types";
import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Dropdown } from "ui";

type SpecificationForCategory = {
  key: string;
  label: string;
  options: SpecOption[] | null;
  categoryUuids: string[];
};

type TechnicalSpecsEditorProps = {
  categories: SelectCategories[];
  specifications: SpecificationForCategory[];
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
    return [
      field,
      ...(option ? visibleFields(option.children, values) : []),
    ];
  });

export const TechnicalSpecsEditor = ({
  categories,
  specifications,
}: TechnicalSpecsEditorProps) => {
  const { control, setValue } = useFormContext<ProductFormValues>();
  const categoryUuid = useWatch({ control, name: "categoryUuid" });
  const values = useWatch({ control, name: "technicalAttributes" }) ?? {};

  // Specs assigned to the selected category or any ancestor, as SpecField[].
  const template = useMemo<SpecField[]>(() => {
    if (!categoryUuid) {
      return [];
    }
    const chain = categoryChain(categories, categoryUuid);
    const seen = new Set<string>();
    const fields: SpecField[] = [];
    for (const spec of specifications) {
      if (
        spec.categoryUuids.some((uuid) => chain.has(uuid)) &&
        !seen.has(spec.key)
      ) {
        seen.add(spec.key);
        fields.push({
          key: spec.key,
          label: spec.label,
          options: spec.options ?? [],
        });
      }
    }
    return fields;
  }, [categoryUuid, categories, specifications]);

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
          its parents). Selecting an option can reveal follow-up fields.
        </p>
      </div>

      {template.length === 0 ? (
        <p className="rounded-control border border-dashed border-hairline p-4 text-sm text-faint">
          No specifications apply to this category yet. Assign specifications to
          it (or a parent category) to fill them here.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((field) => (
            <div key={field.key} className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-ink">
                {field.label}
              </label>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
