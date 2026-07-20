"use client";

import { measurementUnits } from "@/db/enum";
import { Plus, Trash2 } from "lucide-react";
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { Button, Combobox, Dropdown, FormError, Input } from "ui";
import { NumericValuesEditor } from "@/components/specifications/numeric-values-editor";

type SpecFieldListProps = {
  name: string;
  depth: number;
};

type SpecFieldRowProps = {
  name: string;
  index: number;
  depth: number;
  onRemove: () => void;
};

type SpecOptionListProps = {
  name: string;
  depth: number;
};

// One sub-field. Like the top-level spec, it can be a dropdown (its own
// options + nested sub-fields) or a number (a unit + optional fixed choices).
const SpecFieldRow = ({ name, index, depth, onRemove }: SpecFieldRowProps) => {
  const { control, register, getFieldState, formState } = useFormContext();
  const valueType = useWatch({ control, name: `${name}.${index}.valueType` });
  const unitError = getFieldState(`${name}.${index}.unit`, formState).error
    ?.message as string | undefined;

  return (
    <div className="flex flex-col gap-3 rounded-control border border-hairline p-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Sub-field label (e.g. PoE budget)"
          {...register(`${name}.${index}.label`)}
        />
        <Button
          type="button"
          variant="icon"
          className="shrink-0"
          onClick={onRemove}
        >
          <Trash2 size={16} />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Value type</label>
          <Controller
            control={control}
            name={`${name}.${index}.valueType`}
            render={({ field }) => (
              <Dropdown
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "select", label: "Dropdown options" },
                  { value: "number", label: "Number (for rules)" },
                ]}
              />
            )}
          />
        </div>

        {valueType === "number" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Unit</label>
            <Controller
              control={control}
              name={`${name}.${index}.unit`}
              render={({ field }) => (
                <Combobox
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Pick a unit"
                  searchPlaceholder="Search units..."
                  options={measurementUnits.map((unit) => ({
                    value: unit,
                    label: unit,
                  }))}
                />
              )}
            />
            <FormError message={unitError} />
          </div>
        )}
      </div>

      {valueType === "number" ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">
            Allowed values (optional)
          </label>
          <p className="text-xs text-faint">
            Fixed numeric choices — leave empty to let products type any
            number. Either way, rules can compute with the value.
          </p>
          <NumericValuesEditor name={`${name}.${index}.numericValues`} />
        </div>
      ) : (
        <SpecOptionList name={`${name}.${index}.options`} depth={depth + 1} />
      )}
    </div>
  );
};

// Sub-fields revealed by a chosen option — a list of nested fields. Mutually
// recursive with SpecOptionList.
const SpecFieldList = ({ name, depth }: SpecFieldListProps) => {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, index) => (
        <SpecFieldRow
          key={field.id}
          name={name}
          index={index}
          depth={depth}
          onRemove={() => remove(index)}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() =>
          append({
            label: "",
            valueType: "select",
            unit: "",
            options: [],
            numericValues: [],
          })
        }
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
