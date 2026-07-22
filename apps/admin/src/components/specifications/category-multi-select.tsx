"use client";

import type { SpecificationFormValues } from "@/app/(dashboard)/specifications/validation";
import type { SelectCategories } from "@/db/schema/categories";
import { buildCategoryTreeOptions } from "@/lib/categories";
import { useMemo } from "react";
import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";
import { Dropdown } from "ui";

type CategoryMultiSelectProps = {
  control: Control<SpecificationFormValues>;
  categories: SelectCategories[];
};

export const CategoryMultiSelect = ({
  control,
  categories,
}: CategoryMultiSelectProps) => {
  const options = useMemo(
    () => buildCategoryTreeOptions(categories),
    [categories],
  );

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
              searchable
              searchPlaceholder="Search categories..."
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
