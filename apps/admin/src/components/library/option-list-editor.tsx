"use client";

import type { SpecOption } from "@/db/types";
import { ArrowDown, ArrowUp, Plus, Undo2, X } from "lucide-react";
import { Input } from "ui";

// ---------------------------------------------------------------------------
// The option list editor — used in THREE places now: a select attribute's own
// master list, one sub-field's picks inside a `group`, and a shared list of its
// own.
//
// In its own file rather than copied, because two of the things it does are
// subtle and a drifted copy would be silently destructive: an existing option is
// RETIRED and never deleted (a product may still hold its value), and on a scale
// the rank is the option's POSITION rather than a number the author types. A copy
// that forgot either would orphan stored values with nothing to look at.
// ---------------------------------------------------------------------------

// One row of the editor. `value` is present on an option that already exists —
// carrying it through is what keeps its identity stable when its label is edited,
// so no product's stored value is orphaned by a rename.
export type OptionDraft = {
  value?: string;
  label: string;
  retired: boolean;
};

type OptionListEditorProps = {
  options: OptionDraft[];
  // Position is the rank, so the arrows only appear when position means something.
  ordered: boolean;
  onChange: (next: OptionDraft[]) => void;
  addLabel: string;
};

export const toDrafts = (options: SpecOption[]): OptionDraft[] =>
  options.map((option) => ({
    value: option.value,
    label: option.label,
    retired: option.retired,
  }));

// The live options of a select, in the shape the service wants. Retired ones are
// dropped because `mergeOptions` reads its input as the CURRENT list — passing a
// retired option back would un-retire it.
export const liveOptions = (options: OptionDraft[], ordered: boolean) =>
  options
    .filter((option) => option.label.trim() !== "" && !option.retired)
    // The rank is the option's POSITION, so the author orders by moving options
    // rather than by inventing numbers. The service falls back to position too,
    // so the two agree.
    .map((option, index) => ({
      value: option.value,
      label: option.label,
      rank: ordered ? index + 1 : null,
    }));

export const OptionListEditor = ({
  options,
  ordered,
  onChange,
  addLabel,
}: OptionListEditorProps) => {
  const setOption = (index: number, patch: Partial<OptionDraft>): void => {
    onChange(
      options.map((option, at) =>
        at === index ? { ...option, ...patch } : option,
      ),
    );
  };

  // Swap with the neighbour. On an ordered attribute the position IS the rank, so
  // this is the whole ordering mechanism — no numbers for the author to invent.
  const moveOption = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= options.length) {
      return;
    }
    const next = [...options];
    const a = next[index];
    const b = next[target];
    if (!a || !b) {
      return;
    }
    next[index] = b;
    next[target] = a;
    onChange(next);
  };

  return (
    <>
      {/* Wrapping flow, not a fixed grid. A grid stretches every box to an
          equal share of the row, so three short options ate the full width;
          a fixed-width box lets as many fit per row as the screen allows —
          six or seven on a wide monitor. */}
      <div className="flex flex-wrap gap-2">
        {options.map((option, index) => (
          <div
            key={option.value ?? `new-${index}`}
            className="flex shrink-0 items-center gap-1"
          >
            <div className="w-40">
              <Input
                placeholder="Option label"
                value={option.label}
                disabled={option.retired}
                onChange={(event) =>
                  setOption(index, { label: event.target.value })
                }
              />
            </div>
            {/* Position is the rank, so ordering is done by moving options
                rather than by typing a number nobody wants to think about. */}
            {ordered && !option.retired && (
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => moveOption(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${option.label || "this option"} earlier`}
                  className="rounded-control px-1 text-faint hover:bg-hover hover:text-ink disabled:opacity-30"
                >
                  <ArrowUp size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => moveOption(index, 1)}
                  disabled={index === options.length - 1}
                  aria-label={`Move ${option.label || "this option"} later`}
                  className="rounded-control px-1 text-faint hover:bg-hover hover:text-ink disabled:opacity-30"
                >
                  <ArrowDown size={11} />
                </button>
              </div>
            )}
            {option.retired ? (
              <button
                type="button"
                onClick={() => setOption(index, { retired: false })}
                className="flex shrink-0 items-center gap-1 rounded-control px-2 py-1.5 text-[11px] text-muted hover:bg-hover hover:text-ink"
                aria-label={`Bring back ${option.label}`}
              >
                <Undo2 size={12} />
                retired
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  option.value
                    ? setOption(index, { retired: true })
                    : onChange(options.filter((_, at) => at !== index))
                }
                className="shrink-0 rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400"
                aria-label={
                  option.value ? `Retire ${option.label}` : "Remove this option"
                }
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Outside the grid — inside it, the button would occupy a cell and jump
          around as options are added. */}
      <button
        type="button"
        onClick={() => onChange([...options, { label: "", retired: false }])}
        className="flex w-fit items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
      >
        <Plus size={13} />
        {addLabel}
      </button>
    </>
  );
};
