"use client";

import type { ProductFormValues } from "@/app/(dashboard)/products/validation";
import { aliasTermTypes } from "@/db/enum";
import { ALIAS_TERM_TYPE_LABELS } from "@/db/label";
import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { Button, Dropdown, Input } from "ui";

const termTypeOptions = aliasTermTypes.map((termType) => ({
  value: termType,
  label: ALIAS_TERM_TYPE_LABELS[termType],
}));

export const AliasesEditor = () => {
  const { control, register } = useFormContext<ProductFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "aliases",
  });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-sm font-semibold text-ink">Identifiers</label>
        <p className="mt-1 text-xs text-muted">
          Every name a product can be found by — barcode, BOM / PID / Part
          Number, vendor SKU, nickname. All are searchable.
        </p>
      </div>

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid grid-cols-1 items-start gap-2 rounded-control border border-hairline p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <Input
            placeholder="Value (e.g. 6901443...)"
            {...register(`aliases.${index}.searchTerm`)}
          />
          <Controller
            control={control}
            name={`aliases.${index}.termType`}
            render={({ field: typeField }) => (
              <Dropdown
                value={typeField.value}
                onChange={typeField.onChange}
                options={termTypeOptions}
                placeholder="Type"
              />
            )}
          />
          <Input
            placeholder="Label (e.g. BOM, PID)"
            {...register(`aliases.${index}.label`)}
          />
          <Button
            type="button"
            variant="icon"
            className="shrink-0"
            onClick={() => remove(index)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() =>
          append({ searchTerm: "", termType: "manufacturer", label: "" })
        }
      >
        <Plus size={16} />
        Add Identifier
      </Button>
    </div>
  );
};
