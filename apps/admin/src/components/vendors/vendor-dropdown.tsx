"use client";

import { useMemo } from "react";
import { Controller } from "react-hook-form";
import type { Control, FieldValues, Path } from "react-hook-form";
import { Dropdown } from "ui";
import type { DropdownOption } from "ui";
import { FormError } from "ui";
import type { SelectVendors } from "@/db/schema/vendors";

type VendorDropdownProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  vendors: SelectVendors[];
  label?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  error?: string;
  onValueChange?: (value: string) => void;
};

const buildVendorTreeOptions = (
  vendors: SelectVendors[],
): DropdownOption[] => {
  const childrenByParent = new Map<string | null, SelectVendors[]>();

  for (const vendor of vendors) {
    const parentUuid = vendor.parentUuid ?? null;
    const siblings = childrenByParent.get(parentUuid) ?? [];
    siblings.push(vendor);
    childrenByParent.set(parentUuid, siblings);
  }

  const options: DropdownOption[] = [];

  const walk = (parentUuid: string | null, depth: number) => {
    for (const vendor of childrenByParent.get(parentUuid) ?? []) {
      options.push({ value: vendor.uuid, label: vendor.name, depth });
      walk(vendor.uuid, depth + 1);
    }
  };

  walk(null, 0);

  return options;
};

export const VendorDropdown = <TFieldValues extends FieldValues>({
  control,
  name,
  vendors,
  label = "Vendor",
  placeholder = "No vendor",
  allowEmpty = true,
  error,
  onValueChange,
}: VendorDropdownProps<TFieldValues>) => {
  const options = useMemo(() => buildVendorTreeOptions(vendors), [vendors]);

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
