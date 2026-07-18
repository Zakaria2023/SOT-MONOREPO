"use client";

import type { SpecificationFormValues } from "@/app/(dashboard)/specifications/validation";
import type { SelectCategories } from "@/db/schema/categories";
import { useMemo } from "react";
import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";
import { Dropdown } from "ui";
import type { DropdownOption } from "ui";

type CategoryMultiSelectProps = {
  control: Control<SpecificationFormValues>;
  categories: SelectCategories[];
};

// Flatten the category tree into depth-ordered dropdown options.
const buildOptions = (categories: SelectCategories[]): DropdownOption[] => {
  const presentUuids = new Set(categories.map((category) => category.uuid));
  const childrenByParent = new Map<string | null, SelectCategories[]>();
  for (const category of categories) {
    // Treat a category whose parent is missing (deleted, dangling
    // parent_uuid) as a root, otherwise it and its subtree never render.
    const parentUuid =
      category.parentUuid && presentUuids.has(category.parentUuid)
        ? category.parentUuid
        : null;
    const siblings = childrenByParent.get(parentUuid) ?? [];
    siblings.push(category);
    childrenByParent.set(parentUuid, siblings);
  }

  const options: DropdownOption[] = [];
  const walk = (parentUuid: string | null, depth: number) => {
    for (const category of childrenByParent.get(parentUuid) ?? []) {
      options.push({ value: category.uuid, label: category.name, depth });
      walk(category.uuid, depth + 1);
    }
  };
  walk(null, 0);
  return options;
};

export const CategoryMultiSelect = ({
  control,
  categories,
}: CategoryMultiSelectProps) => {
  const options = useMemo(() => buildOptions(categories), [categories]);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-ink">Categories</label>
      <p className="text-xs text-muted">
        The specification applies to the selected categories and all of their
        sub-categories.
      </p>
      <Controller
        control={control}
        name="categoryUuids"
        render={({ field, fieldState }) => (
          <>
            <Dropdown
              multiple
              value={field.value}
              onChange={field.onChange}
              options={options}
              placeholder="Select categories"
            />
            {fieldState.error && (
              <p className="text-xs text-danger">{fieldState.error.message}</p>
            )}
          </>
        )}
      />
    </div>
  );
};
