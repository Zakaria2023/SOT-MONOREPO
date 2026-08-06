"use client";

import { useMemo } from "react";
import { Controller } from "react-hook-form";
import type { Control, FieldValues, Path } from "react-hook-form";
import { Dropdown } from "ui";
import type { DropdownOption } from "ui";
import { FormError } from "ui";
import type { SelectCategories } from "@/db/schema/categories";

type CategoryDropdownProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  categories: SelectCategories[];
  label?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  error?: string;
  onValueChange?: (value: string) => void;
};

const buildCategoryTreeOptions = (
  categories: SelectCategories[],
): DropdownOption[] => {
  const presentUuids = new Set(categories.map((category) => category.uuid));
  const childrenByParent = new Map<string | null, SelectCategories[]>();

  for (const category of categories) {
    // Treat a category as a root when it has no parent, or when its parent
    // row is missing (e.g. the parent was deleted but parent_uuid was left
    // dangling). Otherwise the orphan and its whole subtree never render,
    // since the walk only descends from real roots.
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

export const CategoryDropdown = <TFieldValues extends FieldValues>({
  control,
  name,
  categories,
  label = "Parent Category",
  placeholder = "No parent",
  allowEmpty = true,
  error,
  onValueChange,
}: CategoryDropdownProps<TFieldValues>) => {
  const options = useMemo(
    () => buildCategoryTreeOptions(categories),
    [categories],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink">{label}</label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Dropdown
            searchable
            searchPlaceholder="Search categories..."
            value={typeof field.value === "string" ? field.value : ""}
            onChange={(value) => {
              field.onChange(value);
              onValueChange?.(value);
            }}
            placeholder={placeholder}
            options={
              allowEmpty
                ? [{ value: "", label: placeholder }, ...options]
                : options
            }
          />
        )}
      />
      <FormError message={error} />
    </div>
  );
};
