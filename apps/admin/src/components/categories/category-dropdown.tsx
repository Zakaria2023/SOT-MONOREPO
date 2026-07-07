"use client";

import { useMemo } from "react";
import { Controller } from "react-hook-form";
import type { Control, FieldValues, Path } from "react-hook-form";
import { Dropdown } from "@/components/ui/dropdown";
import type { DropdownOption } from "@/components/ui/dropdown";
import { FormError } from "@/components/ui/form-error";
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
  const childrenByParent = new Map<string | null, SelectCategories[]>();

  for (const category of categories) {
    const parentUuid = category.parentUuid ?? null;
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
      <label className="text-sm font-semibold text-ink">{label}</label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Dropdown
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
