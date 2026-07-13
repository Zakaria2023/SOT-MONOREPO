"use client";

import type { ProductFormValues } from "@/app/(dashboard)/products/validation";
import type { SelectCategories } from "@/db/schema/categories";
import type { SpecField } from "@/db/types";
import { useFormContext, useWatch } from "react-hook-form";
import { Dropdown } from "ui";

type TechnicalSpecsEditorProps = {
  categories: SelectCategories[];
};

type SpecFieldControlsProps = {
  fields: SpecField[];
  values: Record<string, string>;
  onChange: (field: SpecField, value: string) => void;
};

// Every key reachable below a field, across all of its options' subtrees.
const descendantKeys = (field: SpecField): string[] =>
  field.options.flatMap((option) =>
    option.children.flatMap((child) => [child.key, ...descendantKeys(child)]),
  );

const SpecFieldControls = ({
  fields,
  values,
  onChange,
}: SpecFieldControlsProps) => (
  <>
    {fields.map((field) => {
      const selected = values[field.key] ?? "";
      const selectedOption = field.options.find(
        (option) => option.value === selected,
      );

      return (
        <div key={field.key} className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink">
            {field.label}
          </label>
          <Dropdown
            value={selected}
            onChange={(value) => onChange(field, value)}
            placeholder="Select"
            options={[
              { value: "", label: "—" },
              ...field.options.map((option) => ({
                value: option.value,
                label: option.value,
              })),
            ]}
          />

          {selectedOption && selectedOption.children.length > 0 && (
            <div className="flex flex-col gap-4 border-l border-hairline pl-4">
              <SpecFieldControls
                fields={selectedOption.children}
                values={values}
                onChange={onChange}
              />
            </div>
          )}
        </div>
      );
    })}
  </>
);

export const TechnicalSpecsEditor = ({
  categories,
}: TechnicalSpecsEditorProps) => {
  const { control, setValue } = useFormContext<ProductFormValues>();
  const categoryUuid = useWatch({ control, name: "categoryUuid" });
  const values = useWatch({ control, name: "technicalAttributes" }) ?? {};

  const template =
    categories.find((category) => category.uuid === categoryUuid)
      ?.specTemplate ?? [];

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
          Dropdown-only, from this category&apos;s spec template. Selecting an
          option can reveal follow-up fields. Define the fields on the category
          to change what appears here.
        </p>
      </div>

      {template.length === 0 ? (
        <p className="rounded-control border border-dashed border-hairline p-4 text-sm text-faint">
          This category has no spec template yet. Add spec fields on the
          category to fill them here.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SpecFieldControls
            fields={template}
            values={values}
            onChange={handleChange}
          />
        </div>
      )}
    </div>
  );
};
