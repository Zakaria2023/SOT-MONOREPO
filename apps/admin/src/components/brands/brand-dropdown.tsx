"use client";

import { useMemo } from "react";
import { Controller } from "react-hook-form";
import type { Control, FieldValues, Path } from "react-hook-form";
import { Dropdown } from "@/components/ui/dropdown";
import type { DropdownOption } from "@/components/ui/dropdown";
import { FormError } from "@/components/ui/form-error";
import type { SelectBrands } from "@/db/schema/brands";

type BrandDropdownProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  brands: SelectBrands[];
  label?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  error?: string;
};

const buildBrandTreeOptions = (brands: SelectBrands[]): DropdownOption[] => {
  const childrenByParent = new Map<string | null, SelectBrands[]>();

  for (const brand of brands) {
    const parentUuid = brand.parentUuid ?? null;
    const siblings = childrenByParent.get(parentUuid) ?? [];
    siblings.push(brand);
    childrenByParent.set(parentUuid, siblings);
  }

  const options: DropdownOption[] = [];

  const walk = (parentUuid: string | null, depth: number) => {
    for (const brand of childrenByParent.get(parentUuid) ?? []) {
      options.push({ value: brand.uuid, label: brand.name, depth });
      walk(brand.uuid, depth + 1);
    }
  };

  walk(null, 0);

  return options;
};

export const BrandDropdown = <TFieldValues extends FieldValues>({
  control,
  name,
  brands,
  label = "Brand",
  placeholder = "Select a brand",
  allowEmpty = false,
  error,
}: BrandDropdownProps<TFieldValues>) => {
  const options = useMemo(() => buildBrandTreeOptions(brands), [brands]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-ink">{label}</label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Dropdown
            value={typeof field.value === "string" ? field.value : ""}
            onChange={field.onChange}
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
