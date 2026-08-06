"use client";

import { type LibraryAttributeInput } from "@/app/(dashboard)/library/action";
import type { OptionSet } from "services";
import type { SpecificationType } from "@/db/enum";

import { SPECIFICATION_TYPE_LABELS } from "@/db/label";
import { Field } from "@/components/shared/field";
import {
  aliasesFromText,
  aliasesToText,
  emptyOptionDraft,
  liveOptions,
  OptionListEditor,
  toDrafts,
  type OptionDraft,
} from "@/components/library/option-list-editor";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Library,
  Lock,
  Plus,
  X,
} from "lucide-react";

import { useState } from "react";
import {
  Button,
  Checkbox,
  Combobox,
  Dropdown,
  Input,
  Textarea,
  type DropdownOption,
} from "ui";
import {
  GROUP_FIELD_KIND_OPTIONS,
  TYPE_OPTIONS,
  UNIT_OPTIONS,
  isOptionType,
  sourceOptions,
  toFieldDrafts,
} from "@/components/library/library-shared";
import type {
  GroupFieldDraft,
  LibraryAttribute,
} from "@/components/library/library-shared";
/**
 * The attribute editor, ~590 lines and most of why the original file was so long.
 *
 * The shared-list note and the two sub-field editors come with it: nothing else
 * uses them, so they belong beside their only caller.
 */
export type SharedListNoteProps = {
  list: OptionSet;
  // The attribute being edited, so it is not counted among the "others" that a
  // change to the list would also affect.
  exceptLabel?: string;
};

/**
 * What a borrowed list holds and who else holds it.
 *
 * Shown wherever a shared list is chosen — the attribute's own source and each
 * group sub-field's — so the two read identically. A sub-field previously showed a
 * bare line of option text with no name and no scale badge, which left an author
 * unable to tell a shared list from one typed in place.
 */
const SharedListNote = ({ list, exceptLabel }: SharedListNoteProps) => {
  const live = list.options.filter((option) => !option.retired);
  // Everything pointing at the list except the attribute being edited, so the
  // count answers "who ELSE does this change affect".
  const others = [...list.attributeLabels, ...list.groupFieldLabels].filter(
    (label) => label !== exceptLabel,
  );

  return (
    <div className="flex flex-col gap-1 rounded-card border border-hairline bg-hover/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Library size={13} className="shrink-0 text-faint" />
        <span className="text-xs font-medium text-ink">{list.name}</span>
        {list.ordered && (
          <span className="flex items-center gap-1 rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
            <ArrowUpDown size={9} />
            scale
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted">
        {live.map((option) => option.label).join(" · ") ||
          "This shared list has no options yet."}
      </p>
      {/* Editing is deliberately elsewhere. A change made from here would land on
          every attribute pointing at the list, and an author editing one attribute
          has no reason to expect that. */}
      <p className="text-[11px] text-faint">
        {others.length === 0
          ? "Nothing else uses this list yet. Edit it on the Shared lists tab."
          : `Also used by ${others.slice(0, 3).join(", ")}${others.length > 3 ? ` and ${others.length - 3} more` : ""}. Edit it on the Shared lists tab.`}
      </p>
    </div>
  );
};

/**
 * A sub-field's borrowed list, or a plain warning when the pointer dangles.
 *
 * A missing list is said out loud rather than rendered as an empty line: the rows
 * stored under that sub-field will offer nothing to pick, and an author staring at
 * a blank space has no way to know why.
 */
const SubFieldSharedList = ({
  list,
  exceptLabel,
}: {
  list?: OptionSet;
  exceptLabel?: string;
}) =>
  list ? (
    <SharedListNote list={list} exceptLabel={exceptLabel} />
  ) : (
    <p className="text-[11px] text-amber-500">
      This sub-field points at a shared list that no longer exists. Pick another
      one, or give it its own options.
    </p>
  );

// Which of a borrowed list's words ONE COLUMN of a repeatable row uses.
//
// The same narrowing the attribute itself can do, and it earns its place here
// more than it does there: a port group's Speed column on a switch range that
// tops out at 10G has no business offering 100G, and every row an author adds
// puts that dropdown in front of them again.
//
// Nothing is rendered when the list has gone missing — `SubFieldSharedList`
// above already says so, and a second complaint about the same fact is noise.
const SubFieldSlice = ({
  list,
  value,
  onChange,
}: {
  list?: OptionSet;
  value: string[];
  onChange: (next: string[]) => void;
}) =>
  list ? (
    <Field
      label="Which of its values this column uses"
      hint={
        value.length === 0
          ? `All ${list.options.length}, including any added to the list later.`
          : "Exactly these. Values added to the shared list later will not appear here until you add them."
      }
      accessory={
        value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded-control px-2 py-0.5 text-xs text-muted hover:bg-hover hover:text-ink"
          >
            Use all
          </button>
        )
      }
    >
      <Dropdown
        multiple
        value={value}
        onChange={onChange}
        options={list.options
          .filter((option) => !option.retired)
          .map((option) => ({ value: option.value, label: option.label }))}
        // Empty is "all of them", not "none" — the same distinction the stored
        // null draws, said out loud so an untouched field does not read as
        // unanswered.
        placeholder={`All ${list.options.length} values`}
        searchable={list.options.length > 8}
      />
    </Field>
  ) : null;

export type AttributeFormProps = {
  groupUuid: string | null;
  groupOptions: DropdownOption[];
  // Depth-ordered so the tree reads as a tree in the picker.
  categoryOptions: DropdownOption[];
  sharedLists: OptionSet[];
  initial?: LibraryAttribute;
  onSubmit: (input: LibraryAttributeInput) => void;
  onCancel: () => void;
  pending: boolean;
  error?: string;
};

export const AttributeForm = ({
  groupUuid,
  groupOptions,
  categoryOptions,
  sharedLists,
  initial,
  onSubmit,
  onCancel,
  pending,
  error,
}: AttributeFormProps) => {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [categories, setCategories] = useState<string[]>(
    initial?.categoryUuids ?? [],
  );
  const [type, setType] = useState<SpecificationType>(
    initial?.type ?? "single_select",
  );
  const [labelAliases, setLabelAliases] = useState(
    aliasesToText(initial?.labelAliases ?? undefined),
  );
  const [key, setKey] = useState(initial?.key ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [ordered, setOrdered] = useState(initial?.ordered ?? false);
  const [allowRange, setAllowRange] = useState(initial?.allowRange ?? false);
  const [group, setGroup] = useState(initial?.groupUuid ?? groupUuid ?? "");
  const [options, setOptions] = useState<OptionDraft[]>(
    initial ? toDrafts(initial.options) : [emptyOptionDraft()],
  );
  const [optionSetUuid, setOptionSetUuid] = useState(
    initial?.optionSetUuid ?? "",
  );
  // Which of the borrowed list's words this attribute uses. Empty = all of them,
  // which is why it is not seeded with every value: ticking all ten and picking
  // none must not be two different stored states.
  const [setValues, setSetValues] = useState<string[]>(
    initial?.setValues ?? [],
  );
  const [groupFields, setGroupFields] = useState<GroupFieldDraft[]>(
    initial ? toFieldDrafts(initial.groupFields) : [],
  );

  const locked = (initial?.relationshipCount ?? 0) > 0;
  const sources = sourceOptions(sharedLists);
  const chosenList = sharedLists.find((list) => list.uuid === optionSetUuid);

  const setGroupField = (
    index: number,
    patch: Partial<GroupFieldDraft>,
  ): void => {
    setGroupFields((current) =>
      current.map((field, at) =>
        at === index ? { ...field, ...patch } : field,
      ),
    );
  };

  // Sub-field order is the column order of every stored row, so this is how the
  // author decides whether a port group reads "24 · 1G" or "1G · 24".
  const moveGroupField = (index: number, direction: -1 | 1): void => {
    setGroupFields((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      const a = next[index];
      const b = next[target];
      if (!a || !b) {
        return current;
      }
      next[index] = b;
      next[target] = a;
      return next;
    });
  };

  const namedGroupFields = groupFields.filter(
    (field) => field.label.trim() !== "",
  );

  // Mirrors what the service refuses, so the author is stopped here rather than
  // by an error after a save they thought would work.
  const groupIncomplete =
    type === "group" &&
    (namedGroupFields.length === 0 ||
      namedGroupFields.some(
        (field) =>
          field.kind === "select" &&
          field.optionSetUuid === "" &&
          liveOptions(field.options, field.ordered).length === 0,
      ));

  // A select with no vocabulary from either source saves happily and then offers
  // an empty dropdown on the product form, with nothing to say why.
  const selectIncomplete =
    isOptionType(type) &&
    optionSetUuid === "" &&
    liveOptions(options, ordered).length === 0;

  const submit = (): void => {
    onSubmit({
      groupUuid: group === "" ? null : group,
      label,
      internalName: null,
      description: null,
      labelAliases: aliasesFromText(labelAliases),
      key: key.trim() || null,
      type,
      categoryUuids: categories,
      unit: type === "number" ? unit || null : null,
      ordered: isOptionType(type) ? ordered : false,
      allowRange: type === "number" ? allowRange : false,
      // Who sees an attribute is a per-category decision, so it is set on
      // the assignment. The library only says what the attribute IS.
      audience: initial?.audience ?? "everyone",
      // A shared list means the attribute sends NO list of its own. Sending both
      // would leave two lists for one attribute, and the service would have to
      // guess which the author meant.
      options:
        isOptionType(type) && optionSetUuid === ""
          ? liveOptions(options, ordered)
          : [],
      optionSetUuid: isOptionType(type) ? optionSetUuid || null : null,
      setValues: isOptionType(type) && optionSetUuid ? setValues : null,
      groupFields:
        type === "group"
          ? namedGroupFields.map((field) => ({
              // Carried through so a renamed sub-field keeps the key every
              // stored row is filed under.
              key: field.key,
              label: field.label,
              kind: field.kind,
              // Each normalised to its own kind, matching what the service does:
              // a pick carrying a unit, or a count carrying options, would leave
              // the row editor with no honest control to render.
              unit: field.kind === "number" ? field.unit || null : null,
              ordered:
                field.kind === "select" && field.optionSetUuid === ""
                  ? field.ordered
                  : false,
              options:
                field.kind === "select" && field.optionSetUuid === ""
                  ? liveOptions(field.options, field.ordered)
                  : [],
              optionSetUuid:
                field.kind === "select" ? field.optionSetUuid || null : null,
              setValues:
                field.kind === "select" && field.optionSetUuid
                  ? field.setValues
                  : null,
              distinct: field.kind === "select" ? field.distinct : false,
            }))
          : [],
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-card border border-primary/40 bg-surface p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Name"
          placeholder="PoE Budget"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />

        {/* The name everything OUTSIDE this system points at — an import
            mapping, an export, the read model. Left blank it is derived from the
            label; typed, it is kept exactly, which is why `slugify` never
            touches it (it would turn pwr.power_draw_w into pwr-power-draw-w and
            every mapping keyed on the dotted form would resolve to nothing). */}
        <Field
          label="External name"
          hint="How imports and exports refer to this attribute. Leave blank to derive it from the name."
        >
          <Input
            placeholder="pwr.power_draw_w"
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
        </Field>

        {/* What the SOURCES call this attribute, not what we call it. One vendor
            sheet says "Sensitive element" and the next says "Sensing element";
            recorded here, an import lands both on this attribute instead of
            creating a second one nobody notices until a rule stops matching. */}
        <Textarea
          label="Other names in source data"
          rows={2}
          placeholder={"Sensitive element\nSensing element"}
          value={labelAliases}
          onChange={(event) => setLabelAliases(event.target.value)}
        />

        <Field
          label="Categories"
          hint="Which categories use this attribute. How each one uses it is set in Assignments."
        >
          <Dropdown
            multiple
            value={categories}
            onChange={setCategories}
            options={categoryOptions}
            searchable
            placeholder="Select categories"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* A type change would turn every stored value into an unreadable one, so
            once a rule depends on the attribute the type is shown, not offered.
            The service refuses it too — this is only the explanation. */}
        <Field
          label="Type"
          hint={
            locked
              ? `${initial?.relationshipCount} rule(s) use this, so the type is fixed. Create a new attribute instead.`
              : undefined
          }
        >
          {locked ? (
            <div className="flex items-center gap-2 rounded-control border border-hairline bg-hover px-3 py-2 text-sm text-secondary">
              <Lock size={13} className="text-faint" />
              {SPECIFICATION_TYPE_LABELS[type]}
            </div>
          ) : (
            <Dropdown
              value={type}
              onChange={(next) => setType(next as SpecificationType)}
              options={TYPE_OPTIONS}
            />
          )}
        </Field>

        <Field label="Group">
          <Dropdown value={group} onChange={setGroup} options={groupOptions} />
        </Field>
      </div>

      {type === "number" && (
        <div className="flex flex-col gap-4">
          <Field
            label="Unit"
            hint="A rule can only compare two numbers that measure the same thing. W converts to kW; W and VA never convert, because 1500 VA is not 1500 W."
          >
            <Combobox
              value={unit}
              onChange={setUnit}
              options={UNIT_OPTIONS}
              placeholder="Search units…"
            />
          </Field>

          {/* Same plain-question treatment as the ordered checkbox above: the
              author is asked what the number IS, not told how the engine will
              read it. What it does behind the scenes — worst case when it is
              being consumed, guaranteed case when it is being supplied — is not
              a choice they should have to make per attribute. */}
          <div className="flex flex-col gap-2">
            <Checkbox
              label="This is a range, not a single figure"
              checked={allowRange}
              onChange={(event) => setAllowRange(event.target.checked)}
            />
            <p className="-mt-1 text-[11px] text-muted">
              {allowRange
                ? `Products give a lowest and a highest${unit ? ` ${unit}` : ""} — an operating temperature of −20 to 60, a draw that varies 4 to 12. Checks use the end that matters: the most it can need, and the least it can give.`
                : "Leave this off when one figure is the answer, like 8 ports or 130 W."}
            </p>
          </div>
        </div>
      )}

      {/* Free text has nothing to configure — no unit, no list, no scale — so the
          space where those controls would be says what the type is FOR instead.
          Worth the words: the reason this type exists is that authors were
          putting sentences into option lists, and an author who does not know it
          is here will keep doing that. */}
      {type === "text" && (
        <div className="flex flex-col gap-2 rounded-card border border-hairline bg-hover px-3 py-3">
          <p className="text-sm text-ink">Recorded, and nothing more</p>
          <p className="text-xs text-muted">
            Use this for a fact that is genuinely a sentence — a mounting note,
            a licensing caveat, what is in the box. It is stored on the product
            and shown on its spec table.
          </p>
          <p className="text-xs text-muted">
            Nothing can compare prose, so a free-text attribute is never a
            shopper filter, never a rule input and never required before a
            product can be sold. If a rule will need to read this, record it as
            a number or a pick instead.
          </p>
        </div>
      )}

      {isOptionType(type) && (
        <div className="flex flex-col gap-3">
          {/* The source comes FIRST, before the list itself. An author who is
              about to point at a shared vocabulary should not have typed a list
              out only to watch it disappear. */}
          <Field
            label="Where the options come from"
            // With no shared list authored yet this control offers exactly one
            // choice, and a dropdown with a single dead entry reads as a broken
            // field rather than a feature nobody has used — so it says where the
            // second choice comes from instead of leaving the author to find out.
            hint={
              sharedLists.length === 0
                ? "No shared lists yet — create one on the Shared lists tab and it appears here. You want one when this attribute's values have to be comparable with another one's: a cage speed against a module speed. Two attributes on their own lists can never be compared, however alike the options look."
                : "Point at a shared list when this attribute's values have to be comparable with another one's — a cage speed against a module speed. Two attributes on their own lists can never be compared, however alike the options look."
            }
          >
            <Dropdown
              value={optionSetUuid}
              onChange={setOptionSetUuid}
              options={sources}
            />
          </Field>

          {chosenList ? (
            <>
              <SharedListNote
                list={chosenList}
                // Excluded from its own "shared with" count. Without this the note
                // read "shared with 0 other places" on an attribute that was clearly
                // linked, and "1 other place" once saved — the one place being
                // itself.
                exceptLabel={initial?.label}
              />

              {/* Borrowing a vocabulary should not mean swallowing it whole.
                  "Port speed" runs 10M to 100G, and a Module Speed offering 100G
                  on an SFP form is a dropdown full of answers nobody can pick.

                  Narrowing is NOT forking: every value keeps the set's identity,
                  so an attribute offering 1G–25G and one offering the whole scale
                  still spell 10G the same way and still compare. An attribute
                  with its own list would not — which is the whole reason to
                  borrow in the first place. */}
              <Field
                label="Which of its values this attribute uses"
                hint={
                  setValues.length === 0
                    ? `All ${chosenList.options.length}, including any added to the list later.`
                    : "Exactly these. Values added to the shared list later will not appear here until you add them."
                }
                accessory={
                  setValues.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSetValues([])}
                      className="rounded-control px-2 py-0.5 text-xs text-muted hover:bg-hover hover:text-ink"
                    >
                      Use all
                    </button>
                  )
                }
              >
                <Dropdown
                  multiple
                  value={setValues}
                  onChange={setSetValues}
                  options={chosenList.options
                    .filter((option) => !option.retired)
                    .map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  // Empty is "all of them", not "none" — which is why it stays
                  // distinct from ticking every box, and why the placeholder says
                  // so rather than reading as an unanswered field.
                  placeholder={`All ${chosenList.options.length} values`}
                  searchable={chosenList.options.length > 8}
                />
              </Field>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              {/* One plain question instead of the jargon it replaces. The author
                  is not told about ranks or comparators — the rank is derived from
                  the order the options are listed in, which is the thing they can
                  actually see. */}
              <Checkbox
                label="These options go from smallest to largest"
                checked={ordered}
                onChange={(event) => setOrdered(event.target.checked)}
              />
              <p className="-mt-1 text-[11px] text-muted">
                {ordered
                  ? "Listed smallest first. Use the arrows to reorder — a device needing the 2nd option will accept the 3rd, but not the other way round."
                  : "Leave this off for a plain list like Black / White, where no option is bigger than another."}
              </p>

              <OptionListEditor
                options={options}
                ordered={ordered}
                onChange={setOptions}
                addLabel="Add option"
              />

              {selectIncomplete && (
                <p className="text-[11px] text-amber-500">
                  Add at least one option, or take them from a shared list —
                  otherwise the product form offers an empty dropdown.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {type === "group" && (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm text-ink">What one row holds</p>
            <p className="text-[11px] text-muted">
              A product answers this with as many rows as it needs — four port
              groups on a switch, three outlet types on a UPS. Each row is
              filled in with the sub-fields below, in this order.
            </p>
          </div>

          {groupFields.map((field, index) => (
            <div
              key={field.key ?? `new-field-${index}`}
              className="flex flex-col gap-3 rounded-card border border-hairline bg-hover/40 p-3"
            >
              <div className="flex items-start gap-2">
                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Sub-field name"
                    value={field.label}
                    onChange={(event) =>
                      setGroupField(index, { label: event.target.value })
                    }
                  />
                  <Dropdown
                    value={field.kind}
                    onChange={(next) =>
                      setGroupField(index, {
                        kind: next === "number" ? "number" : "select",
                      })
                    }
                    options={GROUP_FIELD_KIND_OPTIONS}
                  />
                </div>

                {/* Sub-field order is the COLUMN order of every row, so it is
                    always reorderable — unlike option order, which only matters
                    on a scale. */}
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    onClick={() => moveGroupField(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${field.label || "this sub-field"} earlier`}
                    className="rounded-control px-1 text-faint hover:bg-hover hover:text-ink disabled:opacity-30"
                  >
                    <ArrowUp size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveGroupField(index, 1)}
                    disabled={index === groupFields.length - 1}
                    aria-label={`Move ${field.label || "this sub-field"} later`}
                    className="rounded-control px-1 text-faint hover:bg-hover hover:text-ink disabled:opacity-30"
                  >
                    <ArrowDown size={11} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setGroupFields((current) =>
                      current.filter((_, at) => at !== index),
                    )
                  }
                  className="shrink-0 rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400"
                  aria-label={`Remove ${field.label || "this sub-field"}`}
                >
                  <X size={14} />
                </button>
              </div>

              {field.kind === "number" ? (
                <Field
                  label="Unit"
                  hint="What the count measures. Leave blank when the sub-field is a plain tally, like how many ports."
                >
                  <Combobox
                    value={field.unit}
                    onChange={(next) => setGroupField(index, { unit: next })}
                    options={UNIT_OPTIONS}
                    placeholder="Search units…"
                  />
                </Field>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* THE reason shared lists exist. A speed list typed inside this
                      group and a speed list on a standalone transceiver attribute
                      spell "1G" identically and store unrelated values, so no rule
                      can ask whether a module fits a cage. Pointing both at one
                      list is what makes that question answerable. */}
                  <Field
                    label="Where the picks come from"
                    hint="Point at a shared list when this sub-field has to be comparable with another attribute — a cage's speed against a module's."
                  >
                    <Dropdown
                      value={field.optionSetUuid}
                      onChange={(next) =>
                        setGroupField(index, { optionSetUuid: next })
                      }
                      options={sources}
                    />
                  </Field>

                  {/* Turns the group from "several of these" into "one fact,
                      several cases". Power draw is one number whose value
                      depends on the supply mode — {12 V DC, 9 W}, {PoE, 8.5 W},
                      {maximum, 12 W} — and a rule reads the case it needs.
                      Without it a case answered twice gets SUMMED, and a 12 W
                      camera silently becomes a 24 W one. */}
                  <Checkbox
                    label="Each row answers a different one of these"
                    checked={field.distinct}
                    onChange={(event) =>
                      setGroupField(index, {
                        distinct: event.target.checked,
                      })
                    }
                  />

                  {field.optionSetUuid === "" ? (
                    <div className="flex flex-col gap-2">
                      <Checkbox
                        label="These options go from smallest to largest"
                        checked={field.ordered}
                        onChange={(event) =>
                          setGroupField(index, {
                            ordered: event.target.checked,
                          })
                        }
                      />
                      <OptionListEditor
                        options={field.options}
                        ordered={field.ordered}
                        onChange={(next) =>
                          setGroupField(index, { options: next })
                        }
                        addLabel="Add option"
                      />
                    </div>
                  ) : (
                    <>
                      <SubFieldSharedList
                        list={sharedLists.find(
                          (list) => list.uuid === field.optionSetUuid,
                        )}
                        exceptLabel={
                          initial
                            ? `${initial.label} · ${field.label}`
                            : undefined
                        }
                      />
                      <SubFieldSlice
                        list={sharedLists.find(
                          (list) => list.uuid === field.optionSetUuid,
                        )}
                        value={field.setValues}
                        onChange={(setValues) =>
                          setGroupField(index, { setValues })
                        }
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setGroupFields((current) => [
                ...current,
                {
                  label: "",
                  setValues: [],
                  kind: "number",
                  unit: "",
                  ordered: false,
                  options: [],
                  optionSetUuid: "",
                  distinct: false,
                },
              ])
            }
            className="flex w-fit items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
          >
            <Plus size={13} />
            Add sub-field
          </button>

          {/* The same two things the service refuses, said before the author
              tries to save rather than after. */}
          {groupIncomplete && (
            <p className="text-[11px] text-amber-500">
              {namedGroupFields.length === 0
                ? "A row needs at least one sub-field — otherwise there is nothing in it to read."
                : "Every sub-field that is a pick needs at least one option, or a shared list to take them from."}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={
            pending ||
            label.trim() === "" ||
            groupIncomplete ||
            selectIncomplete
          }
        >
          {initial ? "Save" : "Add attribute"}
        </Button>
      </div>
    </div>
  );
};
