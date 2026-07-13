"use client";

import type { ProductFormValues } from "@/app/(dashboard)/products/validation";
import type { SelectCategories } from "@/db/schema/categories";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Dropdown } from "ui";

type TechnicalSpecsEditorProps = {
  categories: SelectCategories[];
};

export const TechnicalSpecsEditor = ({
  categories,
}: TechnicalSpecsEditorProps) => {
  const { control } = useFormContext<ProductFormValues>();
  const categoryUuid = useWatch({ control, name: "categoryUuid" });

  const template =
    categories.find((category) => category.uuid === categoryUuid)
      ?.specTemplate ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-sm font-semibold text-ink">
          Technical specifications
        </label>
        <p className="mt-1 text-xs text-muted">
          Dropdown-only, from this category&apos;s spec template. Define the
          fields on the category to change what appears here.
        </p>
      </div>

      {template.length === 0 ? (
        <p className="rounded-control border border-dashed border-hairline p-4 text-sm text-faint">
          This category has no spec template yet. Add spec fields on the
          category to fill them here.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {template.map((field) => (
            <div key={field.key} className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-ink">
                {field.label}
              </label>
              <Controller
                control={control}
                name={`technicalAttributes.${field.key}`}
                render={({ field: valueField }) => (
                  <Dropdown
                    value={valueField.value ?? ""}
                    onChange={valueField.onChange}
                    placeholder="Select"
                    options={[
                      { value: "", label: "—" },
                      ...field.options.map((option) => ({
                        value: option,
                        label: option,
                      })),
                    ]}
                  />
                )}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
