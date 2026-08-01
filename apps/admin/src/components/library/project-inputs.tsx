"use client";

import {
  addVariableAction,
  deleteVariableAction,
  updateVariableAction,
  type ProjectVariableInput,
} from "@/app/(dashboard)/library/action";
import { Field } from "@/components/shared/field";
import { measurementUnits, projectVariableTypes, UNIT_DIMENSIONS } from "@/db/enum";
import { PROJECT_VARIABLE_TYPE_LABELS } from "@/db/label";
import type { SelectProjectVariables } from "@/db/schema/project-variables";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Button,
  Combobox,
  ConfirmDialog,
  Dropdown,
  Input,
  type DropdownOption,
} from "ui";

type ProjectInputsProps = {
  variables: SelectProjectVariables[];
};

type VariableFormProps = {
  initial?: SelectProjectVariables;
  onSubmit: (input: ProjectVariableInput) => void;
  onCancel: () => void;
  pending: boolean;
  error?: string;
};

const TYPE_OPTIONS: DropdownOption[] = projectVariableTypes.map((type) => ({
  value: type,
  label: PROJECT_VARIABLE_TYPE_LABELS[type],
}));

const UNIT_OPTIONS: DropdownOption[] = measurementUnits.map((unit) => {
  const dimension = UNIT_DIMENSIONS[unit];
  return {
    value: unit,
    label: dimension ? `${unit} — ${dimension.dimension}` : unit,
  };
});

const VariableForm = ({
  initial,
  onSubmit,
  onCancel,
  pending,
  error,
}: VariableFormProps) => {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [type, setType] = useState<"number" | "boolean">(
    initial?.type ?? "number",
  );
  const [unit, setUnit] = useState(initial?.unit ?? "");

  return (
    <div className="flex flex-col gap-3 rounded-card border border-primary/40 bg-surface p-4">
      <Input
        label="Question the buyer answers"
        placeholder="How many calls do you expect at the same time?"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Answer type">
          <Dropdown
            value={type}
            onChange={(next) => setType(next as "number" | "boolean")}
            options={TYPE_OPTIONS}
          />
        </Field>

        {type === "number" && (
          <Field label="Unit">
            <Combobox
              value={unit}
              onChange={setUnit}
              options={UNIT_OPTIONS}
              placeholder="Search units…"
            />
          </Field>
        )}

      </div>

      <p className="text-[11px] text-muted">
        There is no default: the buyer is always asked. A rule whose input is
        unanswered does not run, which is the honest outcome — it reports the
        question rather than guessing at a number nobody supplied.
      </p>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          disabled={pending || label.trim() === ""}
          onClick={() =>
            onSubmit({
              label,
              type,
              unit: type === "number" ? unit || null : null,
            })
          }
        >
          {initial ? "Save" : "Add input"}
        </Button>
      </div>
    </div>
  );
};

export const ProjectInputs = ({ variables }: ProjectInputsProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<SelectProjectVariables | null>(
    null,
  );
  const [error, setError] = useState<string>();

  const run = (action: () => Promise<{ error?: string }>): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setAdding(false);
      setEditing(null);
      setConfirming(null);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-card border border-hairline bg-surface p-4">
        <p className="text-sm font-semibold text-ink">
          Numbers the buyer supplies
        </p>
        <p className="mt-1 text-xs text-muted">
          Some rules are not about products at all. “Expected concurrent calls ≤
          PBX capacity” and “access demand ÷ uplink ≤ 20:1” need an answer from
          the person designing the system. These are those answers, and a rule can
          use one on either side exactly like an attribute.
        </p>
      </div>

      {error && !adding && !editing && (
        <p className="rounded-card border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {adding ? (
        <VariableForm
          pending={pending}
          error={error}
          onCancel={() => {
            setAdding(false);
            setError(undefined);
          }}
          onSubmit={(input) => run(() => addVariableAction(input))}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-fit items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
        >
          <Plus size={13} />
          Project input
        </button>
      )}

      {variables.length === 0 && !adding && (
        <p className="rounded-card border border-dashed border-hairline px-3 py-6 text-center text-xs text-faint">
          No project inputs yet.
        </p>
      )}

      {variables.map((variable) =>
        editing === variable.uuid ? (
          <VariableForm
            key={variable.uuid}
            initial={variable}
            pending={pending}
            error={error}
            onCancel={() => {
              setEditing(null);
              setError(undefined);
            }}
            onSubmit={(input) =>
              run(() => updateVariableAction(variable.uuid, input))
            }
          />
        ) : (
          <div
            key={variable.uuid}
            className="flex items-start gap-3 rounded-card border border-hairline bg-surface px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink">
                  {variable.label}
                </span>
                <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
                  {PROJECT_VARIABLE_TYPE_LABELS[variable.type]}
                </span>
                {variable.unit && (
                  <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
                    {variable.unit}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setEditing(variable.uuid)}
                aria-label={`Edit ${variable.label}`}
                className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-ink"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => setConfirming(variable)}
                aria-label={`Delete ${variable.label}`}
                className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ),
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={`Delete “${confirming?.label ?? ""}”?`}
        description="Any rule that uses this input will refuse to be deleted — remove it from those rules first."
        confirmLabel="Delete"
        isConfirming={pending}
        error={error}
        onConfirm={() => {
          if (confirming) {
            run(() => deleteVariableAction(confirming.uuid));
          }
        }}
        onCancel={() => {
          setConfirming(null);
          setError(undefined);
        }}
      />
    </div>
  );
};
