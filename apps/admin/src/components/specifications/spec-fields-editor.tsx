"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Button, Input } from "ui";

type SpecFieldListProps = {
  name: string;
  depth: number;
};

type SpecOptionListProps = {
  name: string;
  depth: number;
};

// Sub-fields revealed by a chosen option — a list of nested fields, each with
// its own options. Mutually recursive with SpecOptionList.
const SpecFieldList = ({ name, depth }: SpecFieldListProps) => {
  const { control, register } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="flex flex-col gap-3 rounded-control border border-hairline p-4"
        >
          <div className="flex items-center gap-2">
            <Input
              placeholder="Sub-field label (e.g. PoE Standard)"
              {...register(`${name}.${index}.label`)}
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

          <SpecOptionList name={`${name}.${index}.options`} depth={depth + 1} />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => append({ label: "", options: [] })}
      >
        <Plus size={16} />
        Add Sub-field
      </Button>
    </div>
  );
};

// The dropdown options for a field. Each option can reveal its own sub-fields.
export const SpecOptionList = ({ name, depth }: SpecOptionListProps) => {
  const { control, register } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-muted">Options</span>

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="flex flex-col gap-2 rounded-control border border-hairline bg-page p-3"
        >
          <div className="flex items-center gap-2">
            <Input
              placeholder="Option value (e.g. Yes)"
              {...register(`${name}.${index}.value`)}
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

          <div className="border-l border-hairline pl-3">
            <p className="mb-2 text-xs text-faint">
              Sub-fields shown on the product only when this option is selected.
            </p>
            <SpecFieldList name={`${name}.${index}.children`} depth={depth} />
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => append({ value: "", children: [] })}
      >
        <Plus size={16} />
        Add Option
      </Button>
    </div>
  );
};
