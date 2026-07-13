"use client";

import type { CategoryFormValues } from "@/app/(dashboard)/categories/validation";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Button, Input, Textarea } from "ui";

export const SpecTemplateEditor = () => {
  const { control, register } = useFormContext<CategoryFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "specTemplate",
  });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-sm font-semibold text-ink">Spec template</label>
        <p className="mt-1 text-xs text-muted">
          Dropdown-only fields products in this category fill. One option per
          line — clean values in, reliable comparison and AI reasoning out.
        </p>
      </div>

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="flex flex-col gap-2 rounded-control border border-hairline p-4"
        >
          <div className="flex items-center gap-2">
            <Input
              placeholder="Field label (e.g. Layer)"
              {...register(`specTemplate.${index}.label`)}
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
          <Textarea
            rows={3}
            placeholder={"Options, one per line\nL2\nL2.5\nL3"}
            {...register(`specTemplate.${index}.optionsText`)}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => append({ label: "", optionsText: "" })}
      >
        <Plus size={16} />
        Add Spec Field
      </Button>
    </div>
  );
};
