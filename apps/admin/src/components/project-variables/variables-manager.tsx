"use client";

import {
  addVariable,
  editVariable,
  removeVariable,
  type ProjectVariableFields,
  type ProjectVariableListItem,
} from "@/app/(dashboard)/project-variables/action";
import { measurementUnits } from "@/db/enum";
import { Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, Dropdown, FormError, Input, Textarea } from "ui";
import type { DropdownOption } from "ui";

type VariablesManagerProps = {
  variables: ProjectVariableListItem[];
};

type VariableFormProps = {
  initial?: ProjectVariableListItem;
  pending: boolean;
  onSubmit: (fields: ProjectVariableFields) => void;
  onCancel: () => void;
};

const UNIT_OPTIONS: DropdownOption[] = measurementUnits.map((value) => ({
  value,
  label: value,
}));

const VariableForm = ({
  initial,
  pending,
  onSubmit,
  onCancel,
}: VariableFormProps) => {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [defaultValue, setDefaultValue] = useState(
    initial?.defaultValue ?? "",
  );

  return (
    <div className="flex flex-col gap-3 rounded-control border border-primary/40 bg-primary-tint/20 p-4">
      <Input
        label="Question"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="e.g. Expected concurrent calls"
      />
      <Textarea
        label="Description"
        rows={2}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="What this number means, and how a designer should answer it (optional)"
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink">Unit</label>
          <Dropdown
            searchable
            value={unit}
            onChange={setUnit}
            placeholder="Pick a unit"
            searchPlaceholder="Search units…"
            options={UNIT_OPTIONS}
          />
          <p className="text-xs text-muted">
            Must match the unit of the specification it&apos;s compared
            against — calls against calls, days against days.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Input
            label="Default"
            type="number"
            step="any"
            value={defaultValue}
            onChange={(event) => setDefaultValue(event.target.value)}
            placeholder="Optional"
          />
          <p className="text-xs text-muted">
            Used when a design hasn&apos;t answered yet. Without one, rules
            reading this variable simply don&apos;t apply until it&apos;s
            answered — never treated as zero.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          disabled={pending || label.trim().length === 0}
          onClick={() =>
            onSubmit({
              label: label.trim(),
              description: description.trim() || null,
              unit: unit || null,
              defaultValue: defaultValue.trim() || null,
            })
          }
        >
          {pending ? "Saving…" : initial ? "Save" : "Add variable"}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-secondary hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export const VariablesManager = ({ variables }: VariablesManagerProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);

  const run = (action: () => Promise<{ error?: string }>, done: () => void) =>
    startTransition(async () => {
      const result = await action();
      setError(result.error);
      if (!result.error) {
        done();
      }
    });

  return (
    <div className="flex flex-col gap-5 rounded-card border border-hairline bg-surface p-7 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
      <div className="flex items-center gap-3 border-b border-hairline pb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-tint text-primary">
          <SlidersHorizontal size={20} />
        </div>
        <div>
          <h2 className="font-heading text-xl text-ink">Project variables</h2>
          <p className="text-xs text-muted">
            Numbers a design answers, not ones a product carries
          </p>
        </div>
      </div>

      <p className="rounded-control bg-primary-tint p-4 text-xs text-secondary">
        A rule usually compares one product against another. Some don&apos;t: a
        PBX&apos;s maximum concurrent calls is a product spec, but the calls you
        actually expect is a decision about the project. Define those questions
        here, and rules can read them exactly like a specification. Each BOQ
        answers them for itself.
      </p>

      <FormError message={error} />

      {variables.length === 0 ? (
        <p className="rounded-control border border-dashed border-hairline p-6 text-center text-sm text-faint">
          No project variables yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-hairline">
          {variables.map((variable) => (
            <li key={variable.uuid} className="py-3">
              {editingUuid === variable.uuid ? (
                <VariableForm
                  initial={variable}
                  pending={isPending}
                  onCancel={() => setEditingUuid(null)}
                  onSubmit={(fields) =>
                    run(
                      () => editVariable(variable.uuid, fields),
                      () => setEditingUuid(null),
                    )
                  }
                />
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">
                        {variable.label}
                      </span>
                      {variable.unit && (
                        <span className="rounded bg-page px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                          {variable.unit}
                        </span>
                      )}
                      {variable.defaultValue !== null && (
                        <span className="rounded bg-page px-1.5 py-0.5 text-[10px] text-muted">
                          default {Number(variable.defaultValue)}
                        </span>
                      )}
                      {variable.ruleCount > 0 && (
                        <span className="rounded bg-primary-tint px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          {variable.ruleCount} rule
                          {variable.ruleCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    {variable.description && (
                      <p className="mt-0.5 text-xs text-muted">
                        {variable.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-faint">
                      key: {variable.key}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingUuid(variable.uuid)}
                      aria-label={`Edit ${variable.label}`}
                      className="rounded p-1.5 text-faint transition-colors hover:bg-page hover:text-ink"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        run(
                          () => removeVariable(variable.uuid),
                          () => undefined,
                        )
                      }
                      aria-label={`Delete ${variable.label}`}
                      className="rounded p-1.5 text-faint transition-colors hover:bg-page hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <VariableForm
          pending={isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(fields) =>
            run(
              () => addVariable(fields),
              () => setAdding(false),
            )
          }
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-fit items-center gap-1.5 rounded-control border border-hairline px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
        >
          <Plus size={15} />
          Add variable
        </button>
      )}
    </div>
  );
};
