"use client";

import {
  addAttributeAction,
  addGroupAction,
  deleteAttributeAction,
  deleteGroupAction,
  moveAttributeAction,
  reorderGroupsAction,
  updateAttributeAction,
  updateGroupAction,
  type LibraryAttributeInput,
  type LibraryGroup,
} from "@/app/(dashboard)/library/action";
import type {
  AssignmentAudience,
  SpecificationDomain,
  SpecificationType,
} from "@/db/enum";
import {
  assignmentAudiences,
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
import type { SelectCategories } from "@/db/schema/categories";
import type { SpecOption } from "@/db/types";
import { buildCategoryTreeOptions } from "@/lib/categories";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FolderPlus,
  Hash,
  Link2,
  ListChecks,
  Lock,
  Pencil,
  Plus,
  Search,
  ToggleLeft,
  Trash2,
  Undo2,
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
  return (
    SPECIFICATION_DOMAIN_LABELS[domain as SpecificationDomain] ?? domain
  );
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
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-secondary">Domain</span>
        <Dropdown value={domain} onChange={setDomain} options={DOMAIN_OPTIONS} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          disabled={pending || name.trim() === ""}
          onClick={() => onSubmit({ name, domain: domain === "" ? null : domain })}
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
  initial?: LibraryAttribute;
  onSubmit: (input: LibraryAttributeInput) => void;
  onCancel: () => void;
  pending: boolean;
  error?: string;
};

// One row of the option editor. `value` is present on an option that already
// exists — carrying it through is what keeps its identity stable when its label
// is edited, so no product's stored value is orphaned by a rename.
type OptionDraft = {
  value?: string;
  label: string;
  rank: string;
  retired: boolean;
};

type SearchHit = LibraryAttribute & { groupLabel: string };

const TYPE_OPTIONS: DropdownOption[] = specificationTypes.map((type) => ({
  value: type,
  label: SPECIFICATION_TYPE_LABELS[type],
}));

const AUDIENCE_OPTIONS: DropdownOption[] = assignmentAudiences.map(
  (audience) => ({
    value: audience,
    label: ASSIGNMENT_AUDIENCE_LABELS[audience],
  }),
);

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
  return <ArrowUpDown size={15} className="text-faint" />;
};

const toDrafts = (options: SpecOption[]): OptionDraft[] =>
  options.map((option) => ({
    value: option.value,
    label: option.label,
    rank: option.rank === null ? "" : String(option.rank),
    retired: option.retired,
  }));

const AttributeForm = ({
  groupUuid,
  groupOptions,
  categoryOptions,
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
  const [audience, setAudience] = useState<AssignmentAudience>(
    initial?.audience ?? "everyone",
  );
  const [group, setGroup] = useState(initial?.groupUuid ?? groupUuid ?? "");
  const [options, setOptions] = useState<OptionDraft[]>(
    initial ? toDrafts(initial.options) : [{ label: "", rank: "", retired: false }],
  );

  const locked = (initial?.relationshipCount ?? 0) > 0;

  const setOption = (index: number, patch: Partial<OptionDraft>): void => {
    setOptions((current) =>
      current.map((option, at) =>
        at === index ? { ...option, ...patch } : option,
      ),
    );
  };

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
      audience,
      options: isOptionType(type)
        ? options
            .filter((option) => option.label.trim() !== "" && !option.retired)
            .map((option) => ({
              value: option.value,
              label: option.label,
              rank: option.rank.trim() === "" ? null : Number(option.rank),
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

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-secondary">Categories</span>
          <Dropdown
            multiple
            value={categories}
            onChange={setCategories}
            options={categoryOptions}
            searchable
            placeholder="Not used by any category yet"
          />
          <span className="text-[11px] text-muted">
            Ticking a category starts using this attribute there. Unticking stops
            it. How each category uses it — filter, options offered, what reveals
            it — is set in Assignments, and nothing here overwrites that.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-secondary">Type</span>
          {/* A type change would turn every stored value into an unreadable one,
              so once a rule depends on the attribute the type is shown, not
              offered. The service refuses it too — this is only the explanation. */}
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
          {locked && (
            <span className="text-[11px] text-amber-500">
              {initial?.relationshipCount} rule(s) use this — the type is fixed.
              Create a new attribute instead.
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-secondary">Group</span>
          <Dropdown value={group} onChange={setGroup} options={groupOptions} />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-secondary">Shown to</span>
          <Dropdown
            value={audience}
            onChange={(next) => setAudience(next as AssignmentAudience)}
            options={AUDIENCE_OPTIONS}
          />
        </div>
      </div>

      {type === "number" && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-secondary">Unit</span>
          <Combobox
            value={unit}
            onChange={setUnit}
            options={UNIT_OPTIONS}
            placeholder="Search units…"
          />
          <span className="text-[11px] text-muted">
            A rule can only compare two numbers that measure the same thing. W
            converts to kW; W and VA never convert, because 1500 VA is not
            1500 W.
          </span>
        </div>
      )}

      {isOptionType(type) && (
        <div className="flex flex-col gap-2">
          <Checkbox
            label="These options are an ordered scale"
            checked={ordered}
            onChange={(event) => setOrdered(event.target.checked)}
          />
          <p className="-mt-1 text-[11px] text-muted">
            Turn this on for 802.3af &lt; at &lt; bt or 1G &lt; 10G. It is what
            makes “at most” comparisons possible. Each option then needs a rank —
            use the real magnitude where there is one (1G = 1000).
          </p>

          <div className="flex flex-col gap-1.5">
            {options.map((option, index) => (
              <div
                key={option.value ?? `new-${index}`}
                className="flex items-center gap-2"
              >
                <Input
                  placeholder="Option label"
                  value={option.label}
                  disabled={option.retired}
                  onChange={(event) =>
                    setOption(index, { label: event.target.value })
                  }
                />
                {ordered && (
                  <div className="w-24 shrink-0">
                    <Input
                      type="number"
                      placeholder="rank"
                      value={option.rank}
                      disabled={option.retired}
                      onChange={(event) =>
                        setOption(index, { rank: event.target.value })
                      }
                    />
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
                        : setOptions((current) =>
                            current.filter((_, at) => at !== index),
                          )
                    }
                    className="shrink-0 rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400"
                    aria-label={
                      option.value
                        ? `Retire ${option.label}`
                        : "Remove this option"
                    }
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setOptions((current) => [
                  ...current,
                  { label: "", rank: "", retired: false },
                ])
              }
              className="flex w-fit items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
            >
              <Plus size={13} />
              Add option
            </button>
          </div>

          <p className="text-[11px] text-muted">
            Options are never deleted, only retired. A product already holding a
            retired value keeps it — deleting the option would leave that product
            pointing at something that no longer exists, and it would quietly
            drop out of every rule reading this attribute.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending || label.trim() === ""}>
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
          <span className="text-sm font-medium text-ink">{attribute.label}</span>
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
          {attribute.audience !== "everyone" && (
            <span className="rounded-full bg-hover px-1.5 py-0.5 text-[10px] text-secondary">
              {ASSIGNMENT_AUDIENCE_LABELS[attribute.audience]}
            </span>
          )}
        </div>

        {live.length > 0 && (
          <p className="mt-1 line-clamp-1 text-xs text-muted">
            {live
              .map((option) =>
                attribute.ordered && option.rank !== null
                  ? `${option.label} (${option.rank})`
                  : option.label,
              )
              .join(" · ")}
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

  const run = (action: () => Promise<{ error?: string }>): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
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
