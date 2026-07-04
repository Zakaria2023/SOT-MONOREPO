"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import type { ProductFormValues } from "@/app/(dashboard)/products/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const HighlightsEditor = () => {
  const { control, register } = useFormContext<ProductFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "highlights",
  });

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-semibold text-ink">Highlights</label>

      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <Input
            placeholder="Key (e.g. Throughput)"
            {...register(`highlights.${index}.k`)}
          />
          <Input
            placeholder="Value (e.g. 10 Gbps)"
            {...register(`highlights.${index}.v`)}
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
        onClick={() => append({ k: "", v: "" })}
      >
        <Plus size={16} />
        Add Highlight
      </Button>
    </div>
  );
};
