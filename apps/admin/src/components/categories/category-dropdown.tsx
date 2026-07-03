"use client";

import { useMemo } from "react";
import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";
import type { CategoryFormValues } from "@/app/(dashboard)/categories/new/validation";
import { Dropdown } from "@/components/ui/dropdown";
import type { DropdownOption } from "@/components/ui/dropdown";
import type { SelectCategories } from "@/db/schema/categories";

type CategoryDropdownProps = {
  control: Control<CategoryFormValues>;
  categories: SelectCategories[];
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

export const CategoryDropdown = ({
  control,
  categories,
}: CategoryDropdownProps) => {
  const options = useMemo(
    () => buildCategoryTreeOptions(categories),
    [categories],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-ink">
        Parent Category
      </label>
      <Controller
        control={control}
        name="parentUuid"
        render={({ field }) => (
          <Dropdown
            value={field.value ?? ""}
            onChange={field.onChange}
            placeholder="No parent"
            options={[{ value: "", label: "No parent" }, ...options]}
          />
        )}
      />
    </div>
  );
};
