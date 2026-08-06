"use client";

import { useMemo } from "react";
import { Controller } from "react-hook-form";
import type { Control, FieldValues, Path } from "react-hook-form";
import { Dropdown, FormError } from "ui";
import type { DropdownOption } from "ui";
import type { SelectClassifications } from "@/db/schema/classifications";

type ClassificationDropdownProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  classifications: SelectClassifications[];
  label?: string;
  placeholder?: string;
  error?: string;
};

export const ClassificationDropdown = <TFieldValues extends FieldValues>({
  control,
  name,
  classifications,
  label = "Classification",
  placeholder = "No classification",
  error,
}: ClassificationDropdownProps<TFieldValues>) => {
  const options = useMemo<DropdownOption[]>(
    () => [
      { value: "", label: placeholder },
      ...classifications.map((classification) => ({
        value: classification.uuid,
        label: classification.name,
      })),
    ],
    [classifications, placeholder],
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
            searchPlaceholder="Search classifications..."
            value={typeof field.value === "string" ? field.value : ""}
            onChange={field.onChange}
            placeholder={placeholder}
            options={options}
          />
        )}
      />
      <FormError message={error} />
    </div>
  );
};
