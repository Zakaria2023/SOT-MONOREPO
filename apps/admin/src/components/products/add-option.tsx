"use client";

import { addSpecOption } from "@/app/(dashboard)/products/action";
import type { SpecOption } from "@/db/types";
import { Plus, TriangleAlert, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, Input } from "ui";

// ---------------------------------------------------------------------------
// Adding a missing value without leaving the half-filled form.
//
// The behaviour this replaces: the list has no "802.3at", so the author either
// picks the closest thing or comes back later and types "PoE+ (802.3at)". Both are
// silent, and the second is worse — from then on half the catalog says one and
// half says the other, and every rule keyed on the first stops matching the rest.
//
// So this is not a convenience shortcut. It is the controlled version of what
// people were already going to do, and the control is entirely in what it says
// before writing:
//
//   - it names an existing option the new label might be a second name for, and
//     offers to use that one instead
//   - it says when the list is SHARED, and with what, because that add is not local
//   - it says when the category's slice had to be widened, because otherwise the
//     value would be added and not appear
// ---------------------------------------------------------------------------

type AddOptionProps = {
  specificationUuid: string;
  // Only on a group column.
  groupFieldKey?: string;
  // The category being authored, so a narrowed slice can be widened to match.
  categoryUuid?: string;
  // What the field is called, for the prompt.
  label: string;
  // Splices the new option into the field and selects it. The parent owns the
  // list, because the form must not reload and lose what is typed.
  onAdded: (option: SpecOption) => void;
};

export const AddOption = ({
  specificationUuid,
  groupFieldKey,
  categoryUuid,
  label,
  onAdded,
}: AddOptionProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [similar, setSimilar] = useState<SpecOption[]>([]);
  const [note, setNote] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const reset = (): void => {
    setDraft("");
    setSimilar([]);
    setError(undefined);
  };

  const submit = (confirmed: boolean): void => {
    if (draft.trim() === "") {
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await addSpecOption({
        specificationUuid,
        groupFieldKey,
        categoryUuid,
        label: draft,
        confirmed,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.status === "similar") {
        setSimilar(result.similar);
        return;
      }
      // Said after the fact rather than asked before it: widening the slice and
      // naming the other users are consequences of an add the author has already
      // decided on, and a second confirmation for each would train them to click
      // through both.
      const notes = [
        result.sharedWith.length > 0
          ? `This list is shared — it also changes ${result.sharedWith.slice(0, 3).join(", ")}${result.sharedWith.length > 3 ? ` and ${result.sharedWith.length - 3} more` : ""}.`
          : null,
        result.widenedSlice
          ? "This category only offered some of the values, so it was widened to include this one."
          : null,
      ].filter((entry): entry is string => entry !== null);
      setNote(notes.length > 0 ? notes.join(" ") : undefined);
      onAdded(result.option);
      setOpen(false);
      reset();
    });
  };

  if (!open) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 self-start text-[11px] font-semibold text-primary hover:underline"
        >
          <Plus size={12} />
          Add a value to {label}
        </button>
        {note && <span className="text-[11px] text-muted">{note}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-control border border-hairline bg-base px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-faint uppercase">
          New value for {label}
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="shrink-0 rounded-control p-0.5 text-faint hover:bg-hover"
          aria-label="Cancel"
        >
          <X size={13} />
        </button>
      </div>

      <Input
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          // A changed label is a different question, so a previous answer about
          // near-duplicates must not carry over into it.
          setSimilar([]);
        }}
        placeholder="e.g. 802.3bt"
      />

      {similar.length > 0 && (
        <div className="flex flex-col gap-2 rounded-control bg-warning-tint/40 px-2.5 py-2">
          <span className="flex items-start gap-1.5 text-[11px] leading-relaxed text-warning">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" />
            This may already exist under another name. Two spellings of one
            value split the catalog in half, and every rule keyed on the other
            one stops matching these products.
          </span>
          <div className="flex flex-wrap gap-1.5">
            {similar.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onAdded(option);
                  setOpen(false);
                  reset();
                }}
                className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-hover"
              >
                Use &ldquo;{option.label}&rdquo;
                {option.retired ? " (retired)" : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <span className="text-[11px] text-danger">{error}</span>}

      <Button
        type="button"
        className="self-start"
        onClick={() => submit(similar.length > 0)}
        disabled={pending || draft.trim() === ""}
      >
        {pending
          ? "Adding…"
          : similar.length > 0
            ? "Add it anyway"
            : "Add value"}
      </Button>
    </div>
  );
};
