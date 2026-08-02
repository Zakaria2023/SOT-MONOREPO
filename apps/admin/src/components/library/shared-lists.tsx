"use client";

import {
  addSharedListAction,
  deleteSharedListAction,
  updateSharedListAction,
} from "@/app/(dashboard)/library/action";
import type { OptionSet, OptionSetInput } from "services";
import {
  liveOptions,
  OptionListEditor,
  toDrafts,
  type OptionDraft,
} from "@/components/library/option-list-editor";
import { ArrowUpDown, Library, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Checkbox, ConfirmDialog, Input } from "ui";

// ---------------------------------------------------------------------------
// SHARED LISTS — one vocabulary, spelled the same way everywhere it is used.
//
// Why an author would want one, said plainly on the screen rather than left for
// them to work out: a switch declares its cages and a transceiver declares its
// own speed, and until both took their speeds from ONE list, "1G" in each was a
// different stored value that merely looked the same. No rule could ask whether
// the module fits the cage.
//
// The screen's whole job is to make the consequence visible. Every list says what
// currently borrows it, because a rename or a retirement here is felt in all of
// those places at once — which is the point, and also the risk.
// ---------------------------------------------------------------------------

type SharedListsProps = {
  lists: OptionSet[];
};

type ListFormProps = {
  initial?: OptionSet;
  onSubmit: (input: OptionSetInput) => void;
  onCancel: () => void;
  pending: boolean;
  error?: string;
};

const usedBy = (list: OptionSet): string[] => [
  ...list.attributeLabels,
  ...list.groupFieldLabels,
];

const ListForm = ({
  initial,
  onSubmit,
  onCancel,
  pending,
  error,
}: ListFormProps) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [ordered, setOrdered] = useState(initial?.ordered ?? false);
  const [options, setOptions] = useState<OptionDraft[]>(
    initial ? toDrafts(initial.options) : [{ label: "", retired: false }],
  );

  const empty = liveOptions(options, ordered).length === 0;
  const borrowers = initial ? usedBy(initial) : [];

  return (
    <div className="flex flex-col gap-4 rounded-card border border-primary/40 bg-surface p-4">
      <Input
        label="Name"
        placeholder="Port Speed"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <div className="flex flex-col gap-2">
        {/* On the SET and not on the attributes borrowing it: whether 1G is
            smaller than 10G belongs to the words themselves, and two attributes
            sharing a list must never be able to disagree about it. */}
        <Checkbox
          label="These options go from smallest to largest"
          checked={ordered}
          onChange={(event) => setOrdered(event.target.checked)}
        />
        <p className="-mt-1 text-[11px] text-muted">
          {ordered
            ? "Listed smallest first. This is what lets a rule ask whether one value is at least another — a 10G cage taking a 1G module."
            : "Leave this off for a plain list where no option is bigger than another."}
        </p>

        <OptionListEditor
          options={options}
          ordered={ordered}
          onChange={setOptions}
          addLabel="Add option"
        />
      </div>

      {borrowers.length > 0 && (
        <p className="rounded-card border border-hairline bg-hover/40 px-3 py-2 text-[11px] text-muted">
          Changing this list changes it for {borrowers.join(", ")}. Removing an
          option retires it rather than deleting it, so products already holding
          that value keep it.
        </p>
      )}

      {empty && (
        <p className="text-[11px] text-amber-500">
          A shared list needs at least one option — an empty one leaves every
          attribute using it with nothing to offer.
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          disabled={pending || name.trim() === "" || empty}
          onClick={() =>
            onSubmit({
              name,
              ordered,
              options: liveOptions(options, ordered),
            })
          }
        >
          {initial ? "Save" : "Add shared list"}
        </Button>
      </div>
    </div>
  );
};

export const SharedLists = ({ lists }: SharedListsProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<OptionSet | null>(null);
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
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-2xl text-xs text-muted">
          A list several attributes take their options from, so their stored
          values are comparable. Two attributes on their own lists can never be
          compared by a rule, however alike the options look — a cage speed and
          a module speed both reading “1G” are unrelated until they come from
          here.
        </p>
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setError(undefined);
          }}
          className="flex shrink-0 items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
        >
          <Plus size={13} />
          Shared list
        </button>
      </div>

      {error && !adding && !editing && (
        <p className="rounded-card border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {adding && (
        <ListForm
          pending={pending}
          error={error}
          onCancel={() => {
            setAdding(false);
            setError(undefined);
          }}
          onSubmit={(input) => run(() => addSharedListAction(input))}
        />
      )}

      {lists.length === 0 && !adding && (
        <p className="rounded-card border border-dashed border-hairline px-3 py-8 text-center text-xs text-faint">
          No shared lists yet. Add one when two attributes need to hold
          comparable values.
        </p>
      )}

      {lists.map((list) => {
        if (editing === list.uuid) {
          return (
            <ListForm
              key={list.uuid}
              initial={list}
              pending={pending}
              error={error}
              onCancel={() => {
                setEditing(null);
                setError(undefined);
              }}
              onSubmit={(input) =>
                run(() => updateSharedListAction(list.uuid, input))
              }
            />
          );
        }

        const live = list.options.filter((option) => !option.retired);
        const borrowers = usedBy(list);

        return (
          <div
            key={list.uuid}
            className="flex items-start gap-3 rounded-card border border-hairline bg-surface px-3 py-2.5"
          >
            <div className="mt-0.5">
              <Library size={15} className="text-faint" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink">
                  {list.name}
                </span>
                {list.ordered && (
                  <span className="flex items-center gap-1 rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
                    <ArrowUpDown size={9} />
                    scale
                  </span>
                )}
              </div>

              <p className="mt-1 line-clamp-2 text-xs text-muted">
                {live.map((option) => option.label).join(" · ")}
              </p>

              {/* Named, not counted. "4 attributes" tells an author nothing about
                  what a retirement here is about to affect. */}
              <p className="mt-1 text-[11px] text-faint">
                {borrowers.length === 0
                  ? "Not used yet"
                  : `Used by ${borrowers.join(", ")}`}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setEditing(list.uuid);
                  setError(undefined);
                }}
                aria-label={`Edit ${list.name}`}
                className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-ink"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => setConfirming(list)}
                aria-label={`Delete ${list.name}`}
                className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        );
      })}

      <ConfirmDialog
        open={confirming !== null}
        title={`Delete “${confirming?.name ?? ""}”?`}
        description={
          confirming && usedBy(confirming).length > 0
            ? `${usedBy(confirming).join(", ")} take their options from this list, so it cannot be deleted yet. Point those at another list first.`
            : "Nothing uses this list, so deleting it affects no stored value."
        }
        confirmLabel="Delete"
        isConfirming={pending}
        error={error}
        onConfirm={() => {
          if (confirming) {
            run(() => deleteSharedListAction(confirming.uuid));
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
