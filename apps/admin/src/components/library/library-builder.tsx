"use client";

import {
  addAttributeAction,
  addGroupAction,
  deleteAttributeAction,
  deleteGroupAction,
  reorderGroupsAction,
  updateAttributeAction,
  updateGroupAction,
  type LibraryAttributeInput,
  type LibraryGroup,
  type OptionSet,
} from "@/app/(dashboard)/library/action";
import type { SpecificationDomain, SpecificationType } from "@/db/enum";
import {
  measurementUnits,
  specificationDomains,
  specificationTypes,
  UNIT_DIMENSIONS,
} from "@/db/enum";
import {
  ASSIGNMENT_AUDIENCE_LABELS,
  SPECIFICATION_DOMAIN_LABELS,
  SPECIFICATION_TYPE_LABELS,
} from "@/db/label";
import { Field } from "@/components/shared/field";
import {
  liveOptions,
  OptionListEditor,
  toDrafts,
  type OptionDraft,
} from "@/components/library/option-list-editor";
import type { SelectCategories } from "@/db/schema/categories";
import type { SpecGroupField } from "@/db/types";
import { buildCategoryTreeOptions } from "@/lib/categories";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FolderPlus,
  Hash,
  Library,
  Link2,
  ListChecks,
  Lock,
  Pencil,
  Plus,
  Rows3,
  Search,
  ToggleLeft,
  Trash2,
  TriangleAlert,
  Type,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Button,
  Checkbox,
  Combobox,
  ConfirmDialog,
  Dropdown,
  Input,
  type DropdownOption,
} from "ui";

type LibraryAttribute = LibraryGroup["attributes"][number];

type LibraryBuilderProps = {
  groups: LibraryGroup[];
  categories: SelectCategories[];
  // The shared vocabularies an attribute or a sub-field may point at instead of
  // owning its own list.
  sharedLists: OptionSet[];
};

type GroupFormProps = {
  initial?: { name: string; domain: string | null };
  onSubmit: (fields: { name: string; domain: string | null }) => void;
  onCancel: () => void;
  pending: boolean;
};

// The domain a group is bucketed under on the product picker. "" = no domain,
// which drops the group into the trailing "Other" bucket.
const DOMAIN_OPTIONS: DropdownOption[] = [
  { value: "", label: "No domain" },
  ...specificationDomains.map((domain) => ({
    value: domain,
    label: SPECIFICATION_DOMAIN_LABELS[domain],
  })),
];

const domainLabel = (domain: string | null): string => {
  if (!domain) {
    return "No domain";
  }
  return SPECIFICATION_DOMAIN_LABELS[domain as SpecificationDomain] ?? domain;
};

const GroupForm = ({
  initial,
  onSubmit,
  onCancel,
  pending,
}: GroupFormProps) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [domain, setDomain] = useState(initial?.domain ?? "");

  return (
    <div className="flex flex-col gap-2 rounded-card border border-primary/40 bg-surface p-3">
      <Input
        label="Group name"
        placeholder="Power"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Field label="Domain">
        <Dropdown
          value={domain}
          onChange={setDomain}
          options={DOMAIN_OPTIONS}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          disabled={pending || name.trim() === ""}
          onClick={() =>
            onSubmit({ name, domain: domain === "" ? null : domain })
          }
        >
          {initial ? "Save" : "Add group"}
        </Button>
      </div>
    </div>
  );
};

type AttributeFormProps = {
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

// One row of the sub-field editor, for a `group` attribute. `key` is present on a
// sub-field that already exists, and carrying it through is what keeps a
// product's stored rows readable when its label is edited — a row is an object
// keyed by these, so a re-derived key orphans every row at once.
type GroupFieldDraft = {
  key?: string;
  label: string;
  kind: "number" | "select";
  unit: string;
  ordered: boolean;
  options: OptionDraft[];
  // "" = this sub-field owns its picks. Anything else is a shared list's uuid,
  // and then `options`/`ordered` above are not shown and not sent.
  optionSetUuid: string;
};

type SharedListNoteProps = {
  list: OptionSet;
  // The attribute being edited, so it is not counted among the "others" that a
  // change to the list would also affect.
  exceptLabel?: string;
};

type SearchHit = LibraryAttribute & { groupLabel: string };

const TYPE_OPTIONS: DropdownOption[] = specificationTypes.map((type) => ({
  value: type,
  label: SPECIFICATION_TYPE_LABELS[type],
}));

// The two things a sub-field can be. Named for what an author sees rather than
// for the stored kind: a count is a number box, a pick is a dropdown.
const GROUP_FIELD_KIND_OPTIONS: DropdownOption[] = [
  { value: "number", label: "A count" },
  { value: "select", label: "A pick from a list" },
];

// The unit picker shows what each unit MEASURES, because that is what decides
// whether a rule may compare two attributes. W and kW convert; W and VA never
// do, and the label is where an author finds that out.
const UNIT_OPTIONS: DropdownOption[] = measurementUnits.map((unit) => {
  const dimension = UNIT_DIMENSIONS[unit];
  return {
    value: unit,
    label: dimension ? `${unit} — ${dimension.dimension}` : unit,
  };
});

const TYPE_META: Record<
  SpecificationType,
  { badge: string; className: string }
> = {
  number: { badge: "number", className: "bg-blue-500/15 text-blue-400" },
  single_select: {
    badge: "select",
    className: "bg-violet-500/15 text-violet-400",
  },
  multi_select: {
    badge: "multi",
    className: "bg-emerald-500/15 text-emerald-400",
  },
  boolean: { badge: "yes / no", className: "bg-amber-500/15 text-amber-500" },
  group: { badge: "rows", className: "bg-sky-500/15 text-sky-400" },
  // Deliberately the muted one. A free-text attribute feeds nothing, and the
  // badge should not suggest it sits alongside the types that do.
  text: { badge: "text", className: "bg-hover text-secondary" },
};

const isOptionType = (type: SpecificationType): boolean =>
  type === "single_select" || type === "multi_select";

const TypeIcon = ({ type }: { type: SpecificationType }) => {
  if (type === "number") {
    return <Hash size={15} className="text-faint" />;
  }
  if (type === "boolean") {
    return <ToggleLeft size={15} className="text-faint" />;
  }
  if (type === "multi_select") {
    return <ListChecks size={15} className="text-faint" />;
  }
  if (type === "group") {
    return <Rows3 size={15} className="text-faint" />;
  }
  if (type === "text") {
    return <Type size={15} className="text-faint" />;
  }
  return <ArrowUpDown size={15} className="text-faint" />;
};

const toFieldDrafts = (fields: SpecGroupField[]): GroupFieldDraft[] =>
  fields.map((field) => ({
    key: field.key,
    label: field.label,
    kind: field.kind,
    unit: field.unit ?? "",
    ordered: field.ordered,
    options: toDrafts(field.options),
    optionSetUuid: field.optionSetUuid ?? "",
  }));

// Where a select's options come from. "" is the default and the common case —
// most attributes have no reason to share a vocabulary, and pointing at one is
// how an author says "these two must be comparable".
const sourceOptions = (sharedLists: OptionSet[]): DropdownOption[] => [
  { value: "", label: "This attribute's own list" },
  ...sharedLists.map((list) => ({
    value: list.uuid,
    label: `${list.name}${list.ordered ? " (a scale)" : ""}`,
  })),
];

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

const AttributeForm = ({
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
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [ordered, setOrdered] = useState(initial?.ordered ?? false);
  const [allowRange, setAllowRange] = useState(initial?.allowRange ?? false);
  const [group, setGroup] = useState(initial?.groupUuid ?? groupUuid ?? "");
  const [options, setOptions] = useState<OptionDraft[]>(
    initial ? toDrafts(initial.options) : [{ label: "", retired: false }],
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
                  kind: "number",
                  unit: "",
                  ordered: false,
                  options: [],
                  optionSetUuid: "",
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

const AttributeRow = ({
  attribute,
  onEdit,
  onDelete,
}: {
  attribute: LibraryAttribute;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const meta = TYPE_META[attribute.type];
  const live = attribute.options.filter((option) => !option.retired);
  const referenced = attribute.relationshipCount > 0;

  return (
    <div className="flex items-start gap-3 rounded-card border border-hairline bg-surface px-3 py-2.5">
      <div className="mt-0.5">
        <TypeIcon type={attribute.type} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">
            {attribute.label}
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.className}`}
          >
            {meta.badge}
          </span>
          {attribute.unit && (
            <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
              {attribute.unit}
            </span>
          )}
          {attribute.ordered && (
            <span className="flex items-center gap-1 rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
              <ArrowUpDown size={9} />
              scale
            </span>
          )}
          {/* Worth its own badge: the options below are borrowed, so editing them
              is not done here, and this attribute's values are comparable with
              every other attribute carrying the same badge. */}
          {attribute.optionSetUuid && (
            <span className="flex items-center gap-1 rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
              <Library size={9} />
              shared list
            </span>
          )}
          {attribute.allowRange && (
            <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
              range
            </span>
          )}
          {attribute.audience !== "everyone" && (
            <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
              {ASSIGNMENT_AUDIENCE_LABELS[attribute.audience]}
            </span>
          )}
        </div>

        {live.length > 0 && (
          <p className="mt-1 line-clamp-1 text-xs text-muted">
            {/* Listed in rank order for an ordered attribute, so the sequence
                itself is the information — the numbers behind it are noise. */}
            {live.map((option) => option.label).join(" · ")}
          </p>
        )}

        {/* A group has no master option list, so the line above is always empty
            for one. Its sub-fields in column order are the equivalent summary —
            they are what one stored row actually looks like. */}
        {attribute.groupFields.length > 0 && (
          <p className="mt-1 line-clamp-1 text-xs text-muted">
            {attribute.groupFields.map((field) => field.label).join(" · ")}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-faint">
          {referenced && (
            <span className="flex items-center gap-1 text-primary">
              <Link2 size={10} />
              {attribute.relationshipCount} rule
              {attribute.relationshipCount === 1 ? "" : "s"}
            </span>
          )}
          <span>
            {attribute.categoryCount} categor
            {attribute.categoryCount === 1 ? "y" : "ies"}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${attribute.label}`}
          className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-ink"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${attribute.label}`}
          className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export const LibraryBuilder = ({
  groups,
  categories,
  sharedLists,
}: LibraryBuilderProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>(
    groups[0]?.uuid ?? "",
  );
  const [addingAttribute, setAddingAttribute] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<LibraryAttribute | null>(null);
  const [confirmingGroup, setConfirmingGroup] = useState<LibraryGroup | null>(
    null,
  );

  // Depth-ordered so the picker reads as the tree it is.
  const categoryOptions = useMemo<DropdownOption[]>(
    () => buildCategoryTreeOptions(categories),
    [categories],
  );

  const groupOptions = useMemo<DropdownOption[]>(
    () => [
      { value: "", label: "Ungrouped" },
      ...groups
        .filter((group) => group.uuid !== "")
        .map((group) => ({ value: group.uuid, label: group.name })),
    ],
    [groups],
  );

  // Search spans every group, because an author looking for "PoE Budget" does
  // not know or care which folder it was filed in.
  const hits = useMemo<SearchHit[]>(() => {
    const term = search.trim().toLowerCase();
    if (term === "") {
      return [];
    }
    return groups.flatMap((group) =>
      group.attributes
        .filter(
          (attribute) =>
            attribute.label.toLowerCase().includes(term) ||
            attribute.options.some((option) =>
              option.label.toLowerCase().includes(term),
            ),
        )
        .map((attribute) => ({ ...attribute, groupLabel: group.name })),
    );
  }, [groups, search]);

  const searching = search.trim() !== "";
  const active =
    groups.find((group) => group.uuid === selectedGroup) ?? groups[0];

  const run = (
    action: () => Promise<{ error?: string; warnings?: string[] }>,
  ): void => {
    setError(undefined);
    setWarnings([]);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      // Survives the form closing on purpose — the whole point is that the author
      // reads it after the save, not while they are still editing.
      setWarnings(result.warnings ?? []);
      setAddingAttribute(false);
      setAddingGroup(false);
      setEditingGroup(null);
      setEditing(null);
      setConfirming(null);
      setConfirmingGroup(null);
      router.refresh();
    });
  };

  // Reorder by swapping with the neighbour, then sending the WHOLE order — the
  // service assigns positions by index, so a partial update would leave two
  // groups claiming the same slot.
  const moveGroup = (uuid: string, direction: -1 | 1): void => {
    const real = groups.filter((group) => group.uuid !== "");
    const at = real.findIndex((group) => group.uuid === uuid);
    const target = at + direction;
    if (at === -1 || target < 0 || target >= real.length) {
      return;
    }
    const ordered = real.map((group) => group.uuid);
    const current = ordered[at];
    const swap = ordered[target];
    if (!current || !swap) {
      return;
    }
    ordered[at] = swap;
    ordered[target] = current;
    run(() => reorderGroupsAction(ordered));
  };

  const editForm = (attribute: LibraryAttribute) => (
    <AttributeForm
      key={attribute.uuid}
      groupUuid={attribute.groupUuid}
      groupOptions={groupOptions}
      categoryOptions={categoryOptions}
      sharedLists={sharedLists}
      initial={attribute}
      pending={pending}
      error={error}
      onCancel={() => {
        setEditing(null);
        setError(undefined);
      }}
      onSubmit={(input) =>
        run(() => updateAttributeAction(attribute.uuid, input))
      }
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search every group for an attribute or an option…"
          className="w-full rounded-control border border-hairline bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-faint focus:border-primary focus:outline-none"
        />
      </div>

      {error &&
        !addingAttribute &&
        !editing &&
        !addingGroup &&
        !editingGroup && (
          <p className="rounded-card border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

      {/* Amber and dismissible, not red: the save DID happen. What is left is work
          on the products, and the author is the only one who can do it. */}
      {warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-card border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {warnings.map((warning) => (
              <p key={warning} className="text-xs text-amber-500">
                {warning}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setWarnings([])}
            aria-label="Dismiss"
            className="shrink-0 rounded-control p-1 text-amber-500/70 hover:bg-hover hover:text-amber-500"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {searching ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">
            {hits.length} match{hits.length === 1 ? "" : "es"} across all groups
          </p>
          {hits.map((hit) =>
            editing === hit.uuid ? (
              editForm(hit)
            ) : (
              <div key={hit.uuid} className="flex flex-col gap-1">
                <span className="text-[11px] text-faint">{hit.groupLabel}</span>
                <AttributeRow
                  attribute={hit}
                  onEdit={() => setEditing(hit.uuid)}
                  onDelete={() => setConfirming(hit)}
                />
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
          {/* LEFT — the groups. Filing only: a group is invisible to the shopper
              and to the engine, so nothing here changes how anything behaves. */}
          <aside className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Groups</h2>
              <button
                type="button"
                onClick={() => {
                  setAddingGroup(true);
                  setError(undefined);
                }}
                className="flex items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
              >
                <FolderPlus size={13} />
                Group
              </button>
            </div>

            {addingGroup && (
              <GroupForm
                pending={pending}
                onCancel={() => {
                  setAddingGroup(false);
                  setError(undefined);
                }}
                onSubmit={(fields) => run(() => addGroupAction(fields))}
              />
            )}

            <div className="flex flex-col gap-1">
              {groups.map((group, index) => {
                const isActive = group.uuid === active?.uuid;
                // The trailing "Ungrouped" bucket is not a row in the table, so
                // it cannot be renamed, reordered or deleted.
                const real = group.uuid !== "";

                if (editingGroup === group.uuid) {
                  return (
                    <GroupForm
                      key={group.uuid}
                      initial={{ name: group.name, domain: group.domain }}
                      pending={pending}
                      onCancel={() => {
                        setEditingGroup(null);
                        setError(undefined);
                      }}
                      onSubmit={(fields) =>
                        run(() => updateGroupAction(group.uuid, fields))
                      }
                    />
                  );
                }

                return (
                  <div
                    key={group.uuid || "ungrouped"}
                    className={`flex items-center gap-1 rounded-card border px-2 py-1.5 ${
                      isActive
                        ? "border-primary/40 bg-primary/10"
                        : "border-hairline bg-surface"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedGroup(group.uuid)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span
                        className={`block text-sm ${
                          isActive ? "font-medium text-primary" : "text-ink"
                        }`}
                      >
                        {group.name}
                      </span>
                      <span className="block text-[11px] text-faint">
                        {group.attributes.length} attribute
                        {group.attributes.length === 1 ? "" : "s"}
                        {real ? ` · ${domainLabel(group.domain)}` : ""}
                      </span>
                    </button>

                    {real && (
                      <div className="flex shrink-0 items-center">
                        <button
                          type="button"
                          onClick={() => moveGroup(group.uuid, -1)}
                          disabled={index === 0 || pending}
                          aria-label={`Move ${group.name} up`}
                          className="rounded-control p-1 text-faint hover:bg-hover hover:text-ink disabled:opacity-30"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveGroup(group.uuid, 1)}
                          disabled={pending}
                          aria-label={`Move ${group.name} down`}
                          className="rounded-control p-1 text-faint hover:bg-hover hover:text-ink disabled:opacity-30"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGroup(group.uuid);
                            setError(undefined);
                          }}
                          aria-label={`Rename ${group.name}`}
                          className="rounded-control p-1 text-faint hover:bg-hover hover:text-ink"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingGroup(group)}
                          aria-label={`Delete ${group.name}`}
                          className="rounded-control p-1 text-faint hover:bg-hover hover:text-red-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* RIGHT — the attributes filed in the selected group. */}
          <section className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">
                {active?.name ?? "Attributes"}
                <span className="ml-2 text-xs font-normal text-faint">
                  {active?.attributes.length ?? 0}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  setAddingAttribute(true);
                  setError(undefined);
                }}
                className="flex items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
              >
                <Plus size={13} />
                Attribute
              </button>
            </div>

            {addingAttribute && (
              <AttributeForm
                groupUuid={active && active.uuid !== "" ? active.uuid : null}
                groupOptions={groupOptions}
                categoryOptions={categoryOptions}
                sharedLists={sharedLists}
                pending={pending}
                error={error}
                onCancel={() => {
                  setAddingAttribute(false);
                  setError(undefined);
                }}
                onSubmit={(input) => run(() => addAttributeAction(input))}
              />
            )}

            {(active?.attributes.length ?? 0) === 0 && !addingAttribute && (
              <p className="rounded-card border border-dashed border-hairline px-3 py-8 text-center text-xs text-faint">
                Nothing filed here yet.
              </p>
            )}

            {active?.attributes.map((attribute) =>
              editing === attribute.uuid ? (
                editForm(attribute)
              ) : (
                <AttributeRow
                  key={attribute.uuid}
                  attribute={attribute}
                  onEdit={() => {
                    setEditing(attribute.uuid);
                    setError(undefined);
                  }}
                  onDelete={() => setConfirming(attribute)}
                />
              ),
            )}
          </section>
        </div>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={`Delete “${confirming?.label ?? ""}”?`}
        description={
          confirming && confirming.relationshipCount > 0
            ? `${confirming.relationshipCount} rule(s) depend on this attribute, so it cannot be deleted yet. Repoint or archive those rules first.`
            : "Products already holding a value for this attribute will lose it. This cannot be undone."
        }
        confirmLabel="Delete"
        isConfirming={pending}
        error={error}
        onConfirm={() => {
          if (confirming) {
            run(() => deleteAttributeAction(confirming.uuid));
          }
        }}
        onCancel={() => {
          setConfirming(null);
          setError(undefined);
        }}
      />

      <ConfirmDialog
        open={confirmingGroup !== null}
        title={`Delete the “${confirmingGroup?.name ?? ""}” group?`}
        description={`Its ${confirmingGroup?.attributes.length ?? 0} attribute(s) are NOT deleted — they become ungrouped. A group is a folder, and emptying a folder must never destroy what was filed in it.`}
        confirmLabel="Delete group"
        isConfirming={pending}
        error={error}
        onConfirm={() => {
          if (confirmingGroup) {
            run(() => deleteGroupAction(confirmingGroup.uuid));
          }
        }}
        onCancel={() => {
          setConfirmingGroup(null);
          setError(undefined);
        }}
      />
    </div>
  );
};
