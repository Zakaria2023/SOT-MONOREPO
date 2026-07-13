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

const SpecOptionList = ({ name, depth }: SpecOptionListProps) => {
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
            <SpecFieldList name={`${name}.${index}.children`} depth={depth + 1} />
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
              placeholder="Field label (e.g. PoE)"
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

          <SpecOptionList name={`${name}.${index}.options`} depth={depth} />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => append({ label: "", options: [] })}
      >
        <Plus size={16} />
        {depth === 0 ? "Add Spec Field" : "Add Sub-field"}
      </Button>
    </div>
  );
};

export const SpecTemplateEditor = () => (
  <div className="flex flex-col gap-3">
    <div>
      <label className="text-sm font-semibold text-ink">Spec template</label>
      <p className="mt-1 text-xs text-muted">
        Dropdown-only fields products in this category fill. Give each option its
        own sub-fields to reveal follow-up questions — e.g. PoE → Yes reveals a
        PoE standard field, No hides it.
      </p>
    </div>

    <SpecFieldList name="specTemplate" depth={0} />
  </div>
);
