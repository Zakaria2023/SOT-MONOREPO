"use client";

import { saveScenarioAction } from "@/app/(dashboard)/sandbox/actions";
import type { BasketLine } from "@/components/shared/basket-builder";
import type { ProjectAnswers } from "@/db/types";
import { Bookmark } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, Input } from "ui";

// Keeping a basket is worth a name and a sentence. A scenario nobody can explain
// in a year is one nobody dares delete either, so the note is asked for here
// rather than left to be filled in later, which never happens.

type SaveScenarioProps = {
  lines: BasketLine[];
  answers: ProjectAnswers;
};

export const SaveScenario = ({ lines, answers }: SaveScenarioProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await saveScenarioAction({
        name,
        note: note.trim() || null,
        selection: lines.map((line) => ({
          productUuid: line.productUuid,
          quantity: line.quantity,
        })),
        variables: answers,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setOpen(false);
      setName("");
      setNote("");
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setSaved(false);
          setOpen(true);
        }}
        className="flex items-center justify-center gap-1.5 rounded-control border border-hairline px-3 py-2 text-xs text-secondary hover:bg-hover hover:text-ink"
      >
        <Bookmark size={13} />
        {saved ? "Saved. Keep another?" : "Keep this basket as a scenario"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-primary/40 bg-surface p-3">
      <Input
        label="Name"
        placeholder="Full catalogue, no answers"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Input
        label="Why it is worth keeping"
        placeholder="Caught the PoE rule passing on unread products"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      {error && (
        <p className="rounded-control border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400">
          {error}
        </p>
      )}

      {/* Said plainly, because the alternative is somebody assuming the save
          recorded an expectation and trusting a green suite that agreed to
          nothing. */}
      <p className="text-[11px] text-muted">
        Saved without a verdict. Read what it does, then accept that as the
        baseline.
      </p>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-control px-3 py-2 text-xs text-secondary hover:bg-hover hover:text-ink"
        >
          Cancel
        </button>
        <Button onClick={save} disabled={pending || name.trim() === ""}>
          {pending ? "Saving…" : "Keep it"}
        </Button>
      </div>
    </div>
  );
};
