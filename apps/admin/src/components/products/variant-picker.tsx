"use client";

import { addVariant } from "@/app/(dashboard)/products/action";
import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import type { Variant } from "services";
import { Button, Dropdown, FormError, Input } from "ui";

// ---------------------------------------------------------------------------
// Picking which product this row is.
//
// A product's variants STACK — `FireProtect 2 RB (CO) UL Jeweller` differs from
// its siblings on battery, sensor, certification and radio at once — so this is
// a multi-select, and the set of ticks is half the product's identity.
//
// The list is a controlled vocabulary with an inline way to extend it, rather
// than a free-text box, because the failure mode is otherwise invisible: typed
// fresh on each product, "4G", "(4G)" and "4 G" become three axes that no query
// groups and no importer matches, and every product still looks entered. The
// same reasoning that put the option library behind a controlled add.
//
// Adding one is a popup here rather than a trip to a management page. An author
// discovers a missing variant halfway through a product form, and sending them
// away means losing everything typed so far — which is exactly how people learn
// to type it into the name field instead.
// ---------------------------------------------------------------------------

type VariantPickerProps = {
  // The whole vocabulary, loaded with the page.
  variants: Variant[];
  value: string[];
  onChange: (next: string[]) => void;
};

export const VariantPicker = ({
  variants,
  value,
  onChange,
}: VariantPickerProps) => {
  // Seeded from the server and extended in place, so a variant added in the
  // popup is selectable immediately without a revalidation that would throw away
  // the half-filled form around it.
  const [known, setKnown] = useState(variants);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (): void => {
    const trimmed = name.trim();
    if (trimmed === "") {
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await addVariant({ name: trimmed });
      if ("error" in result) {
        // The service refuses a second spelling of an existing axis by name, so
        // this message is the useful half of the feature — it tells the author
        // which variant to pick instead.
        setError(result.error);
        return;
      }
      setKnown((current) => [...current, result]);
      onChange([...value, result.uuid]);
      setName("");
      setAdding(false);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Dropdown
        multiple
        searchable
        value={value}
        onChange={onChange}
        options={known.map((variant) => ({
          value: variant.uuid,
          label: variant.name,
        }))}
        placeholder="No variants"
        searchPlaceholder="Search variants"
        emptyMessage="No variants yet"
      />

      {adding ? (
        <div className="flex flex-col gap-2 rounded-card border border-primary/40 bg-surface p-3">
          <Input
            label="New variant"
            placeholder="e.g. RB, (4G), White, without casing"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                // The form around this one would otherwise submit the whole
                // product on Enter, saving a row the author was not finished
                // with.
                event.preventDefault();
                submit();
              }
            }}
          />
          <FormError message={error} />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={submit}
              disabled={pending || name.trim() === ""}
            >
              {pending ? "Adding…" : "Add"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setName("");
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-fit items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
        >
          <Plus size={13} />
          New variant
        </button>
      )}
    </div>
  );
};
