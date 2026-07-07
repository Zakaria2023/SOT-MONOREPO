"use client";

import { Button } from "ui";
import { Input } from "ui";
import type { SpecFormValues } from "@/lib/specs";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

type SpecGroupRowsProps = {
  groupIndex: number;
};

const SpecGroupRows = ({ groupIndex }: SpecGroupRowsProps) => {
  const { control, register } = useFormContext<SpecFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `specGroups.${groupIndex}.rows`,
  });

  return (
    <div className="flex flex-col gap-2 pl-4">
      {fields.map((field, rowIndex) => (
        <div key={field.id} className="flex items-center gap-2">
          <Input
            placeholder="Key"
            {...register(`specGroups.${groupIndex}.rows.${rowIndex}.k`)}
          />
          <Input
            placeholder="Value"
            {...register(`specGroups.${groupIndex}.rows.${rowIndex}.v`)}
          />
          <Button
            type="button"
            variant="icon"
            className="shrink-0"
            onClick={() => remove(rowIndex)}
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
        Add Row
      </Button>
    </div>
  );
};

export const SpecGroupsEditor = () => {
  const { control, register } = useFormContext<SpecFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "specGroups",
  });

  return (
    <div className="flex flex-col gap-4">
      <label className="text-sm font-semibold text-ink">Spec Groups</label>

      {fields.map((field, groupIndex) => (
        <div
          key={field.id}
          className="flex flex-col gap-3 rounded-control border border-hairline p-4"
        >
          <div className="flex items-center gap-2">
            <Input
              placeholder="Group title (e.g. Connectivity)"
              {...register(`specGroups.${groupIndex}.title`)}
            />
            <Button
              type="button"
              variant="icon"
              className="shrink-0"
              onClick={() => remove(groupIndex)}
            >
              <Trash2 size={16} />
            </Button>
          </div>

          <SpecGroupRows groupIndex={groupIndex} />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => append({ title: "", rows: [] })}
      >
        <Plus size={16} />
        Add Spec Group
      </Button>
    </div>
  );
};
