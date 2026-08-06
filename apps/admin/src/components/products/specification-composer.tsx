"use client";

import type { ProductFormValues } from "@/app/(dashboard)/products/validation";
import { AddOption } from "@/components/products/add-option";
import { Field } from "@/components/shared/field";
import type { SpecificationType } from "@/db/enum";
import {
  duplicateGroupRows,
  isSpecGroupRows,
  isSpecRange,
  type ProductValue,
  type SpecGroupField,
  type SpecGroupRow,
  type SpecOption,
} from "@/db/types";
import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Dropdown, Input, type DropdownOption } from "ui";

// ---------------------------------------------------------------------------
// The product's specifications.
//
// Pick the specifications this product has from a dropdown, then set each value.
// A label and one control per specification, and the control follows the type:
// one choice for a single-select, several for a multi-select, Yes/No for a
// boolean, a number box for a number.
//
// A field whose reveal condition is met appears on its own — set PoE to Yes and
// PoE Budget shows up without being picked, and goes again when PoE changes.
//
// No rules are defined here and none are explained here. Which specifications a
// category offers comes from Assignments; what the values then mean to the
// compatibility engine is worked out in the cart. This form only records values.
// ---------------------------------------------------------------------------

export type FormField = {
  specificationUuid: string;
  label: string;
  description: string | null;
  type: SpecificationType;
  unit: string | null;
  ordered: boolean;
  // A number answered as a span — two boxes instead of one.
  allowRange: boolean;
  // The slice this category offers — not the whole master list.
  options: SpecOption[];
  // Only on `group`. The sub-fields one repeatable row carries, in column order.
  groupFields: SpecGroupField[];
  isRule: boolean;
  isFilter: boolean;
  inherited: boolean;
  // Serialised reveal condition, evaluated here so the form responds instantly.
  showIf: RevealCondition | null;
  groupName: string | null;
  groupOrder: number;
};

// A deliberately narrow mirror of the server condition: enough to drive the
// form, and nothing that could grow into a second rule language. Anything more
// complex simply shows the field and the server decides on save.
export type RevealCondition = {
  attr: string;
  op: "equals" | "in" | "exists" | "gte" | "lte" | "gt" | "lt";
  values: (string | number | boolean)[];
};

// Sentinel for the ungrouped section, since a dropdown option value is a string.
const UNGROUPED = "__ungrouped__";

type SpecificationComposerProps = {
  fieldsByCategory: Record<string, FormField[]>;
};

type FieldRowProps = {
  field: FormField;
  value: ProductValue | undefined;
  // The category being authored. Passed only so a value added here can widen a
  // slice that would otherwise not offer it.
  categoryUuid?: string;
  // Absent for a field the reveal brought in — it disappears on its own when the
  // condition stops holding, so removing it by hand would be a dead end.
  onRemove?: () => void;
  onChange: (next: ProductValue | undefined) => void;
};

type GroupRowsEditorProps = {
  fields: SpecGroupField[];
  rows: SpecGroupRow[];
  onChange: (next: SpecGroupRow[]) => void;
};

const asList = (value: ProductValue | undefined): string[] => {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  // A span is a quantity, never a set membership — stringifying it would give
  // the equals/in branches "[object Object]" to compare against. A group's rows
  // are the same hazard and they ARE an array, so they have to be caught before
  // the `map(String)` below can reach them.
  if (isSpecRange(value) || isSpecGroupRows(value)) {
    return [];
  }
  return Array.isArray(value) ? value.map(String) : [String(value)];
};

/** One end of a span, as text for its box. */
const rangeEnd = (
  value: ProductValue | undefined,
  end: "min" | "max",
): string => (isSpecRange(value) ? String(value[end]) : "");

/**
 * A span with one end replaced.
 *
 * Both ends live in state even while one is blank, so typing into the first box
 * does not discard what is in the second. A blank end becomes NaN, which the
 * server's `isSpecRange` rejects — so a half-filled span is never stored, and
 * never mistaken for a real answer.
 */
const patchRange = (
  value: ProductValue | undefined,
  end: "min" | "max",
  text: string,
): ProductValue | undefined => {
  const current = isSpecRange(value)
    ? value
    : { min: Number.NaN, max: Number.NaN };
  const next = { ...current, [end]: text === "" ? Number.NaN : Number(text) };
  return Number.isNaN(next.min) && Number.isNaN(next.max) ? undefined : next;
};

const hasValue = (value: ProductValue | undefined): boolean => {
  if (value === undefined || value === null || value === "") {
    return false;
  }
  // A half-filled span does not count. The server drops it, so treating it as
  // answered here would show the author a complete product that saves
  // incomplete — and an incomplete product silently passes every rule.
  if (typeof value === "object" && !Array.isArray(value)) {
    return isSpecRange(value);
  }
  // Same reasoning one level out: a row list the server cannot decode must not
  // read as answered here, or the author sees a filled field that saves empty.
  if (
    Array.isArray(value) &&
    value.some((entry) => typeof entry === "object" && entry !== null)
  ) {
    return isSpecGroupRows(value);
  }
  return !(Array.isArray(value) && value.length === 0);
};

// ---------------------------------------------------------------------------
// Group rows
// ---------------------------------------------------------------------------

const asRows = (value: ProductValue | undefined): SpecGroupRow[] =>
  isSpecGroupRows(value) ? value : [];

/** A row is only an answer once every sub-field is filled — see the server. */
const isRowComplete = (row: SpecGroupRow, fields: SpecGroupField[]): boolean =>
  fields.every((field) => {
    const entry = row[field.key];
    if (field.kind === "number") {
      return typeof entry === "number" && Number.isFinite(entry);
    }
    return typeof entry === "string" && entry.trim().length > 0;
  });

/**
 * A blank row, with every sub-field absent rather than zeroed.
 *
 * A count seeded with 0 is a real answer the author never gave, and it would make
 * the row look complete while contributing nothing to a total.
 */
const blankRow = (): SpecGroupRow => ({});

/**
 * One sub-field of one row, replaced.
 *
 * Clearing a control DELETES the key rather than storing "" or NaN, so an
 * incomplete row stays visibly incomplete instead of holding a value the readers
 * would drop without saying why.
 */
const patchRow = (
  rows: SpecGroupRow[],
  index: number,
  key: string,
  entry: number | string | undefined,
): SpecGroupRow[] =>
  rows.map((row, at) => {
    if (at !== index) {
      return row;
    }
    if (entry === undefined) {
      const rest = { ...row };
      delete rest[key];
      return rest;
    }
    return { ...row, [key]: entry };
  });

const satisfied = (
  condition: RevealCondition | null,
  values: Record<string, ProductValue | undefined>,
): boolean => {
  if (!condition) {
    return true;
  }
  const raw = values[condition.attr];
  if (condition.op === "exists") {
    return hasValue(raw);
  }
  // A span, judged the way the server judges it: the condition has to hold for
  // the WHOLE span, so "at least" reads the low end and "at most" the high one.
  const span = isSpecRange(raw) ? raw : null;
  if (span) {
    const target = Number(condition.values[0]);
    if (!Number.isFinite(target)) {
      return false;
    }
    if (condition.op === "gte") {
      return span.min >= target;
    }
    if (condition.op === "gt") {
      return span.min > target;
    }
    if (condition.op === "lte") {
      return span.max <= target;
    }
    if (condition.op === "lt") {
      return span.max < target;
    }
    // equals/in on a span is not a comparison the form can answer — the server
    // decides on save rather than the field guessing.
    return true;
  }

  const list = asList(raw);
  if (list.length === 0) {
    return false;
  }
  if (condition.op === "equals") {
    return list.length === 1 && String(condition.values[0]) === list[0];
  }
  if (condition.op === "in") {
    const wanted = new Set(condition.values.map(String));
    return list.some((entry) => wanted.has(entry));
  }
  const numeric = Number(raw);
  const target = Number(condition.values[0]);
  if (!Number.isFinite(numeric) || !Number.isFinite(target)) {
    return false;
  }
  if (condition.op === "gte") {
    return numeric >= target;
  }
  if (condition.op === "lte") {
    return numeric <= target;
  }
  if (condition.op === "gt") {
    return numeric > target;
  }
  return numeric < target;
};

/**
 * The repeatable-row control: one row per line, one input per sub-field.
 *
 * This is what replaces "GE RJ45 24 (1G/100M/10M)" typed into a text box. The
 * count is a number, the family and the speed are picks from lists the library
 * owns, and a switch adds as many rows as it has distinct port groups — so
 * nothing here is free text and every part stays comparable.
 */
const GroupRowsEditor = ({ fields, rows, onChange }: GroupRowsEditorProps) => {
  // Which rows answer a discriminator column somebody already answered, keyed by
  // row so the warning lands ON the offending row rather than in a list at the
  // bottom that nobody connects to anything.
  //
  // Computed here on every keystroke rather than reported after the save,
  // because that is the only moment the author can act on it: an operand TOTALS
  // a group column, so two rows both saying "maximum" make a 12 W camera measure
  // 24 W — and the resulting budget failure names a number that appears on no
  // datasheet anywhere. The engine catches it too, through the very same
  // `duplicateGroupRows`, but by then the product is saved and nobody is looking.
  const clashes = new Map<number, { label: string; value: string }>();
  for (const subField of fields) {
    for (const clash of duplicateGroupRows(rows, subField)) {
      const option = subField.options.find(
        (entry) => entry.value === clash.value,
      );
      clashes.set(clash.index, {
        label: subField.label,
        value: option?.label ?? clash.value,
      });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => {
        const complete = isRowComplete(row, fields);
        const clash = clashes.get(index);
        return (
          <div
            key={index}
            className="flex flex-wrap items-start gap-2 rounded-card border border-hairline bg-hover/40 p-2"
          >
            {fields.map((subField) => {
              const entry = row[subField.key];
              const live = subField.options.filter((option) => !option.retired);
              return (
                <div key={subField.key} className="min-w-28 flex-1">
                  {subField.kind === "number" ? (
                    <Input
                      type="number"
                      placeholder={subField.label}
                      aria-label={subField.label}
                      value={typeof entry === "number" ? String(entry) : ""}
                      onChange={(event) =>
                        onChange(
                          patchRow(
                            rows,
                            index,
                            subField.key,
                            event.target.value === ""
                              ? undefined
                              : Number(event.target.value),
                          ),
                        )
                      }
                      rightSlot={
                        subField.unit ? (
                          <span className="text-xs text-faint">
                            {subField.unit}
                          </span>
                        ) : undefined
                      }
                    />
                  ) : (
                    <Dropdown
                      value={typeof entry === "string" ? entry : ""}
                      onChange={(next) =>
                        onChange(
                          patchRow(
                            rows,
                            index,
                            subField.key,
                            next === "" ? undefined : next,
                          ),
                        )
                      }
                      options={live.map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                      placeholder={subField.label}
                      searchable={live.length > 8}
                    />
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => onChange(rows.filter((_, at) => at !== index))}
              aria-label={`Remove row ${index + 1}`}
              className="mt-2 shrink-0 rounded-control p-1 text-faint hover:bg-hover hover:text-red-400"
            >
              <X size={13} />
            </button>

            {/* Said on the row itself, because the readers DROP an incomplete row
              rather than partly counting it — so a half-filled port group would
              otherwise look entered and contribute nothing. */}
            {!complete && (
              <p className="w-full text-xs text-amber-500">
                Fill every box, or this row is ignored.
              </p>
            )}

            {/* Red rather than amber, and it is the only thing in this editor that
              is. An incomplete row is IGNORED — the design simply measures less
              than it should. A duplicate is COUNTED TWICE, so the design
              measures more, and the number it produces cannot be traced back to
              anything on a datasheet. */}
            {clash && (
              <p className="w-full text-xs text-red-500">
                {clash.label} is already “{clash.value}” on an earlier row. Each
                one can be answered once — two rows here are added together.
              </p>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onChange([...rows, blankRow()])}
        className="flex w-fit items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
      >
        <Plus size={13} />
        Add row
      </button>
    </div>
  );
};

/**
 * Options an author added from this form, merged into the list the server sent.
 *
 * Kept in component state rather than revalidating the route: the form is
 * half-filled, and reloading it to pick up one new option would throw away
 * everything else typed so far.
 *
 * A deliberately reused RETIRED option is copied in as live. The author chose it
 * from the near-duplicate prompt, so it has to be selectable — and the copy is
 * local to this render, so the library row keeps saying what it says.
 */
const withAdded = (
  options: SpecOption[],
  added: SpecOption[],
): SpecOption[] => [
  ...options.filter((option) => !option.retired),
  ...added
    .filter(
      (entry) =>
        !options.some(
          (option) => option.value === entry.value && !option.retired,
        ),
    )
    .map((entry) => ({ ...entry, retired: false })),
];

const FieldRow = ({
  field,
  value,
  categoryUuid,
  onChange,
  onRemove,
}: FieldRowProps) => {
  // Keyed by column for a group, and by "" for the attribute's own list.
  const [added, setAdded] = useState<Record<string, SpecOption[]>>({});
  const record = (key: string, option: SpecOption): void => {
    setAdded((current) => ({
      ...current,
      [key]: [...(current[key] ?? []), option],
    }));
  };

  const live = withAdded(field.options, added[""] ?? []);
  const selected = asList(value);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{field.label}</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${field.label}`}
            className="shrink-0 rounded-control p-1 text-faint hover:bg-hover hover:text-red-400"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {field.type === "number" &&
        (field.allowRange ? (
          // Two boxes, one value. Both ends are kept in state even while one is
          // blank so typing the first does not wipe the second; the SERVER drops
          // a half-filled span, because a value it cannot read back is worse
          // than no value at all.
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Lowest"
              value={rangeEnd(value, "min")}
              onChange={(event) =>
                onChange(patchRange(value, "min", event.target.value))
              }
            />
            <span className="shrink-0 text-xs text-faint">to</span>
            <Input
              type="number"
              placeholder="Highest"
              value={rangeEnd(value, "max")}
              onChange={(event) =>
                onChange(patchRange(value, "max", event.target.value))
              }
              rightSlot={
                field.unit ? (
                  <span className="text-xs text-faint">{field.unit}</span>
                ) : undefined
              }
            />
          </div>
        ) : (
          <Input
            type="number"
            value={value === undefined ? "" : String(value)}
            onChange={(event) =>
              onChange(
                event.target.value === ""
                  ? undefined
                  : Number(event.target.value),
              )
            }
            rightSlot={
              field.unit ? (
                <span className="text-xs text-faint">{field.unit}</span>
              ) : undefined
            }
          />
        ))}

      {field.type === "text" && (
        // A textarea rather than an Input, because the type only exists for facts
        // that are a sentence. A single-line box would quietly invite the short
        // answers that should have been options in the first place.
        <textarea
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? undefined : event.target.value)
          }
          placeholder={`Notes on ${field.label.toLowerCase()}`}
          className="w-full resize-y rounded-control border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-primary focus:outline-none"
        />
      )}

      {field.type === "boolean" && (
        <Dropdown
          value={value === undefined ? "" : value === true ? "true" : "false"}
          onChange={(next) =>
            onChange(next === "" ? undefined : next === "true")
          }
          options={[
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ]}
          placeholder="Not set"
        />
      )}

      {field.type === "single_select" && (
        <>
          <Dropdown
            value={selected[0] ?? ""}
            onChange={(next) => onChange(next === "" ? undefined : next)}
            options={live.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            placeholder="Not set"
            searchable={live.length > 8}
          />
          <AddOption
            specificationUuid={field.specificationUuid}
            categoryUuid={categoryUuid}
            label={field.label}
            onAdded={(option) => {
              record("", option);
              onChange(option.value);
            }}
          />
        </>
      )}

      {field.type === "multi_select" && (
        <>
          <Dropdown
            multiple
            value={selected}
            onChange={(next) => onChange(next.length === 0 ? undefined : next)}
            options={live.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            placeholder="Not set"
            searchable={live.length > 8}
            emptyMessage="This category offers no options here"
          />
          <AddOption
            specificationUuid={field.specificationUuid}
            categoryUuid={categoryUuid}
            label={field.label}
            onAdded={(option) => {
              record("", option);
              // Added, then ticked. An author who adds a value on a multi-select
              // means to use it — leaving it added but unticked would read as the
              // add having failed.
              onChange([...selected, option.value]);
            }}
          />
        </>
      )}

      {field.type === "group" &&
        (field.groupFields.length === 0 ? (
          // The library refuses to save a group without sub-fields, so this only
          // shows for a row written before that guard existed. Better than
          // rendering an "Add row" button that produces rows nothing can read.
          <p className="rounded-card border border-dashed border-hairline px-3 py-4 text-center text-xs text-faint">
            This specification has no sub-fields yet. Add them in the Library.
          </p>
        ) : (
          <>
            <GroupRowsEditor
              fields={field.groupFields.map((subField) => ({
                ...subField,
                options: withAdded(subField.options, added[subField.key] ?? []),
              }))}
              rows={asRows(value)}
              // An empty list is not a value — the readers treat a group with no
              // rows as unanswered, so the form has to store nothing rather than [].
              onChange={(next) =>
                onChange(next.length === 0 ? undefined : next)
              }
            />
            {/* Per COLUMN and below the rows, not inside one. A value belongs to
                the column; offering it on a row would suggest it were local to
                that row, and repeating the control per row would put the same
                button on screen five times. */}
            {field.groupFields
              .filter((subField) => subField.kind === "select")
              .map((subField) => (
                <AddOption
                  key={subField.key}
                  specificationUuid={field.specificationUuid}
                  groupFieldKey={subField.key}
                  categoryUuid={categoryUuid}
                  label={subField.label}
                  onAdded={(option) => record(subField.key, option)}
                />
              ))}
          </>
        ))}
    </div>
  );
};

export const SpecificationComposer = ({
  fieldsByCategory,
}: SpecificationComposerProps) => {
  const { control, setValue } = useFormContext<ProductFormValues>();
  const categoryUuid = useWatch({ control, name: "categoryUuid" });
  // Memoised because the `?? {}` fallback would otherwise be a fresh object on
  // every render, re-running every memo below it each time.
  const watchedValues = useWatch({ control, name: "specValues" });
  const specValues = useMemo(() => watchedValues ?? {}, [watchedValues]);

  const [groupFilter, setGroupFilter] = useState<string[]>([]);

  // Specifications picked in this session that have no value yet. A field with a
  // value needs no separate record of being picked — the value IS the record,
  // which is why nothing extra is stored on the product.
  const [added, setAdded] = useState<string[]>([]);

  const fields = useMemo(
    () => fieldsByCategory[categoryUuid] ?? [],
    [fieldsByCategory, categoryUuid],
  );

  const picked = useMemo(() => {
    const set = new Set(added);
    for (const field of fields) {
      if (hasValue(specValues[field.specificationUuid])) {
        set.add(field.specificationUuid);
      }
    }
    return set;
  }, [added, fields, specValues]);

  // What is on the form: everything picked, plus anything a reveal condition has
  // brought in. Run to a fixed point, so hiding a trigger also hides whatever it
  // revealed rather than leaving an orphan behind.
  const shown = useMemo(() => {
    let current = fields.filter(
      (field) =>
        picked.has(field.specificationUuid) ||
        (field.showIf !== null && satisfied(field.showIf, specValues)),
    );
    for (let pass = 0; pass <= fields.length; pass += 1) {
      const present = new Set(current.map((field) => field.specificationUuid));
      const next = current.filter(
        (field) =>
          !field.showIf ||
          (present.has(field.showIf.attr) &&
            satisfied(field.showIf, specValues)),
      );
      if (next.length === current.length) {
        return next;
      }
      current = next;
    }
    return current;
  }, [fields, picked, specValues]);

  const shownUuids = useMemo(
    () => new Set(shown.map((field) => field.specificationUuid)),
    [shown],
  );

  // Every group the category carries, for the filter. Built from all fields, not
  // just the shown ones, so a group stays selectable before anything in it has
  // been added.
  const groupOptions = useMemo<DropdownOption[]>(() => {
    const seen = new Map<string, number>();
    for (const field of fields) {
      const key = field.groupName ?? UNGROUPED;
      seen.set(key, Math.min(seen.get(key) ?? Infinity, field.groupOrder));
    }
    return [...seen.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([key]) => ({
        value: key,
        label: key === UNGROUPED ? "Other" : key,
      }));
  }, [fields]);

  // An empty filter means every group. Held as a Set so the memos below depend on
  // a value rather than on a function that would be rebuilt every render.
  const allowedGroups = useMemo(
    () => (groupFilter.length === 0 ? null : new Set(groupFilter)),
    [groupFilter],
  );

  // The picker lists what the category carries, minus what is already on the
  // form, narrowed to the chosen groups.
  const options = useMemo<DropdownOption[]>(
    () =>
      fields
        .filter(
          (field) =>
            !shownUuids.has(field.specificationUuid) &&
            (allowedGroups === null ||
              allowedGroups.has(field.groupName ?? UNGROUPED)),
        )
        .map((field) => ({
          value: field.specificationUuid,
          label: field.label,
        })),
    [fields, shownUuids, allowedGroups],
  );

  // One flat list, ordered by the library's group order so related fields still
  // sit together — without a heading or a rule line between them.
  const rows = useMemo(
    () =>
      shown
        .filter(
          (field) =>
            allowedGroups === null ||
            allowedGroups.has(field.groupName ?? UNGROUPED),
        )
        .sort((a, b) => a.groupOrder - b.groupOrder),
    [shown, allowedGroups],
  );

  const writeValues = (next: Record<string, ProductValue>): void => {
    setValue("specValues", next, { shouldDirty: true });
  };

  const update = (uuid: string, next: ProductValue | undefined): void => {
    const values = { ...specValues };
    if (next === undefined) {
      delete values[uuid];
    } else {
      values[uuid] = next;
    }

    // Drop the value of anything this change has just hidden. The server does it
    // again on save — a value left on a hidden field would still be read later,
    // and nobody could see the number doing it.
    const stillShown = new Set<string>();
    let current = fields.filter(
      (field) =>
        picked.has(field.specificationUuid) ||
        (field.showIf !== null && satisfied(field.showIf, values)),
    );
    for (let pass = 0; pass <= fields.length; pass += 1) {
      const present = new Set(current.map((field) => field.specificationUuid));
      const filtered = current.filter(
        (field) =>
          !field.showIf ||
          (present.has(field.showIf.attr) && satisfied(field.showIf, values)),
      );
      if (filtered.length === current.length) {
        current = filtered;
        break;
      }
      current = filtered;
    }
    current.forEach((field) => stillShown.add(field.specificationUuid));

    const carried = new Set(fields.map((field) => field.specificationUuid));
    for (const key of Object.keys(values)) {
      if (carried.has(key) && !stillShown.has(key)) {
        delete values[key];
      }
    }
    writeValues(values);
  };

  const add = (uuids: string[]): void => {
    setAdded((current) => [...new Set([...current, ...uuids])]);
  };

  const remove = (uuid: string): void => {
    setAdded((current) => current.filter((entry) => entry !== uuid));
    const values = { ...specValues };
    delete values[uuid];
    writeValues(values);
  };

  if (!categoryUuid) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-3 py-6 text-center text-xs text-faint">
        Pick a category first — it decides which specifications are available.
      </p>
    );
  }

  if (fields.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-3 py-6 text-center text-xs text-faint">
        This category has no specifications yet. Add them in Assignments and
        they become available here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Groups">
          <Dropdown
            multiple
            value={groupFilter}
            onChange={setGroupFilter}
            options={groupOptions}
            searchable={groupOptions.length > 8}
            placeholder="All groups"
          />
        </Field>

        <Field label="Add specifications">
          <Dropdown
            multiple
            value={[]}
            onChange={add}
            options={options}
            searchable
            placeholder={
              options.length === 0
                ? "Nothing left to add"
                : "Pick specifications to fill in"
            }
            emptyMessage="Nothing left to add"
          />
        </Field>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-hairline px-3 py-6 text-center text-xs text-faint">
          Nothing added yet. Pick a specification above to start.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((field) => (
            <FieldRow
              key={field.specificationUuid}
              field={field}
              value={specValues[field.specificationUuid]}
              categoryUuid={categoryUuid}
              onChange={(next) => update(field.specificationUuid, next)}
              // A conditional field leaves on its own when its trigger changes,
              // so it carries no remove button.
              onRemove={
                field.showIf ? undefined : () => remove(field.specificationUuid)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
