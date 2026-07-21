"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "ui";

type NumericValuesEditorProps = {
  // Form path holding the string[] of allowed numeric choices. Generic so it
  // works for the top-level spec (`numericValues`) and any nested sub-field
  // (`options.0.children.1.numericValues`, ...).
  name: string;
};

// Chip editor for a numeric spec's fixed choices. Only parseable numbers can be
// added, so the stored values are always computable by the rule engine.
export const NumericValuesEditor = ({ name }: NumericValuesEditorProps) => {
  const { control, setValue } = useFormContext();
  const watchedValues = useWatch({ control, name });
  const values = useMemo<string[]>(
    () => (Array.isArray(watchedValues) ? watchedValues : []),
    [watchedValues],
  );
  const [draft, setDraft] = useState("");

  const isValidDraft =
    draft.trim() !== "" &&
    Number.isFinite(Number(draft.trim())) &&
    !values.includes(draft.trim());

  const addDraft = () => {
    if (!isValidDraft) {
      return;
    }
    setValue(name, [...values, draft.trim()], { shouldDirty: true });
    setDraft("");
  };

  const remove = (value: string) => {
    setValue(
      name,
      values.filter((candidate) => candidate !== value),
      { shouldDirty: true },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1 text-xs font-medium text-primary"
        >
          {value}
          <button
            type="button"
            aria-label={`Remove ${value}`}
            onClick={() => remove(value)}
            className="text-primary hover:text-primary-hover"
          >
            <X size={12} />
          </button>
        </span>
      ))}

      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addDraft();
          }
        }}
        type="number"
        step="any"
        placeholder="e.g. 24"
        className="w-32 rounded-control border border-hairline bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
      />
      <Button
        type="button"
        onClick={addDraft}
        disabled={!isValidDraft}
        className="flex items-center gap-1 px-3 py-1.5 text-xs"
      >
        <Plus size={13} />
        Add
      </Button>
    </div>
  );
};
