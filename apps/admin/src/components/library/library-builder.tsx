"use client";

import {
  addAttributeAction,
  deleteAttributeAction,
  moveAttributeAction,
  updateAttributeAction,
  type LibraryAttributeInput,
  type LibraryGroup,
} from "@/app/(dashboard)/library/action";
import type { AssignmentAudience, SpecificationType } from "@/db/enum";
import {
  assignmentAudiences,
  measurementUnits,
  specificationTypes,
  UNIT_DIMENSIONS,
} from "@/db/enum";
import {
  ASSIGNMENT_AUDIENCE_LABELS,
  SPECIFICATION_TYPE_LABELS,
} from "@/db/label";
import type { SpecOption } from "@/db/types";
import {
  ArrowUpDown,
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
  Textarea,
  type DropdownOption,
} from "ui";

type LibraryAttribute = LibraryGroup["attributes"][number];

type LibraryBuilderProps = {
  groups: LibraryGroup[];
};

type AttributeFormProps = {
  groupUuid: string | null;
  groupOptions: DropdownOption[];
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
  initial,
  onSubmit,
  onCancel,
  pending,
  error,
}: AttributeFormProps) => {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [internalName, setInternalName] = useState(initial?.internalName ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
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
      internalName: internalName.trim() === "" ? null : internalName,
      description: description.trim() === "" ? null : description,
      type,
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
        <Input
          label="Internal name (optional)"
          placeholder="How staff tell it apart from another “Type”"
          value={internalName}
          onChange={(event) => setInternalName(event.target.value)}
        />
      </div>

      <Textarea
        label="Description (optional)"
        rows={2}
        placeholder="What this measures, in one line."
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />

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
          {attribute.internalName && (
            <span className="text-[11px] text-faint">
              ({attribute.internalName})
            </span>
          )}
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

export const LibraryBuilder = ({ groups }: LibraryBuilderProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState<LibraryAttribute | null>(null);

  const groupOptions = useMemo<DropdownOption[]>(
    () => [
      { value: "", label: "Ungrouped" },
      ...groups
        .filter((group) => group.uuid !== "")
        .map((group) => ({ value: group.uuid, label: group.name })),
    ],
    [groups],
  );

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
            attribute.internalName?.toLowerCase().includes(term) ||
            attribute.options.some((option) =>
              option.label.toLowerCase().includes(term),
            ),
        )
        .map((attribute) => ({ ...attribute, groupLabel: group.name })),
    );
  }, [groups, search]);

  const run = (action: () => Promise<{ error?: string }>): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setAddingIn(null);
      setEditing(null);
      setConfirming(null);
      router.refresh();
    });
  };

  const editForm = (attribute: LibraryAttribute) => (
    <AttributeForm
      key={attribute.uuid}
      groupUuid={attribute.groupUuid}
      groupOptions={groupOptions}
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
          placeholder="Search attributes and options…"
          className="w-full rounded-control border border-hairline bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-faint focus:border-primary focus:outline-none"
        />
      </div>

      {error && !addingIn && !editing && (
        <p className="rounded-card border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {search.trim() !== "" ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">
            {hits.length} match{hits.length === 1 ? "" : "es"}
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
        groups.map((group) => (
          <section key={group.uuid || "ungrouped"} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">
                {group.name}
                <span className="ml-2 text-xs font-normal text-faint">
                  {group.attributes.length}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  setAddingIn(group.uuid);
                  setError(undefined);
                }}
                className="flex items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-hover"
              >
                <Plus size={13} />
                Attribute
              </button>
            </div>

            {addingIn === group.uuid && (
              <AttributeForm
                groupUuid={group.uuid === "" ? null : group.uuid}
                groupOptions={groupOptions}
                pending={pending}
                error={error}
                onCancel={() => {
                  setAddingIn(null);
                  setError(undefined);
                }}
                onSubmit={(input) => run(() => addAttributeAction(input))}
              />
            )}

            {group.attributes.length === 0 && addingIn !== group.uuid && (
              <p className="rounded-card border border-dashed border-hairline px-3 py-4 text-center text-xs text-faint">
                No attributes here yet.
              </p>
            )}

            {group.attributes.map((attribute) =>
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
        ))
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
    </div>
  );
};
