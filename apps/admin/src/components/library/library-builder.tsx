"use client";

import {
  addAttributeAction,
  addGroupAction,
  deleteAttributeAction,
  deleteGroupAction,
  moveAttributeAction,
  reorderGroupsAction,
  updateGroupAction,
  updateAttributeAction,
  type AttributeInput,
  type LibraryBuilderGroup,
} from "@/app/(dashboard)/library/action";
import type { SpecificationDomain, SpecInputType } from "@/db/enum";
import { specInputTypes, specificationDomains } from "@/db/enum";
import {
  SPECIFICATION_DOMAIN_LABELS,
  SPEC_INPUT_TYPE_LABELS,
} from "@/db/label";
import type { SelectCategories } from "@/db/schema/categories";
import { buildCategoryTreeOptions } from "@/lib/categories";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GitCompare,
  Hash,
  List,
  ListChecks,
  Pencil,
  Plus,
  ToggleLeft,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Checkbox, Dropdown, Input, Textarea } from "ui";
import type { DropdownOption } from "ui";

type LibraryBuilderProps = {
  groups: LibraryBuilderGroup[];
  categories: SelectCategories[];
};

type RevealTarget = {
  key: string;
  label: string;
  groupName: string;
};

type AttributeFormProps = {
  groupUuid: string | null;
  initial?: AttributeInput & { uuid: string };
  // Every other library attribute an option can auto-add (reveal), the current
  // attribute excluded so it can't reveal itself.
  revealTargets: RevealTarget[];
  // Depth-ordered category options the attribute can be assigned to.
  categoryOptions: DropdownOption[];
  onSubmit: (input: AttributeInput) => void;
  onCancel: () => void;
  pending: boolean;
};

const INPUT_TYPES: { value: SpecInputType; label: string }[] =
  specInputTypes.map((type) => ({
    value: type,
    label: SPEC_INPUT_TYPE_LABELS[type],
  }));

// The navigation domain a group is bucketed under. "" means no domain — the
// group falls into the trailing "Other" bucket.
const DOMAIN_OPTIONS: DropdownOption[] = [
  { value: "", label: "No domain" },
  ...specificationDomains.map((domain) => ({
    value: domain,
    label: SPECIFICATION_DOMAIN_LABELS[domain],
  })),
];

const TYPE_META: Record<
  SpecInputType,
  { label: string; className: string }
> = {
  number: { label: "num", className: "bg-blue-500/15 text-blue-400" },
  single_select: { label: "select", className: "bg-violet-500/15 text-violet-400" },
  multi_select: { label: "multi", className: "bg-emerald-500/15 text-emerald-400" },
  boolean: { label: "yes / no", className: "bg-amber-500/15 text-amber-500" },
  text: { label: "text", className: "bg-hover text-secondary" },
};

// Options are edited as readable " | "-separated tokens. Users type a space to
// split instead of reaching for the pipe key. A trailing space is kept as a
// dangling " | " so the separator shows the moment they press space; on submit
// the values are split on "|" and trimmed, so the surrounding spaces drop out.
const toPipeSeparated = (raw: string): string => {
  const keepTrailing = /\s$/.test(raw);
  const tokens = raw.split(/[\s|]+/).filter(Boolean);
  if (tokens.length === 0) {
    return "";
  }
  return tokens.join(" | ") + (keepTrailing ? " | " : "");
};

const TypeIcon = ({ type }: { type: SpecInputType }) => {
  if (type === "number") return <Hash size={15} className="text-faint" />;
  if (type === "boolean") return <ToggleLeft size={15} className="text-faint" />;
  if (type === "multi_select")
    return <ListChecks size={15} className="text-faint" />;
  if (type === "text") return <Type size={15} className="text-faint" />;
  return <List size={15} className="text-faint" />;
};

// Inline add/edit form. Options are edited pipe-separated (AC|DC|PoE), matching
// how the attribute reads.
const AttributeForm = ({
  groupUuid,
  initial,
  revealTargets,
  categoryOptions,
  onSubmit,
  onCancel,
  pending,
}: AttributeFormProps) => {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [inputType, setInputType] = useState<SpecInputType>(
    initial?.inputType ?? "single_select",
  );
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [allowRange, setAllowRange] = useState(initial?.allowRange ?? false);
  const [optionsText, setOptionsText] = useState(
    (initial?.options ?? []).join(" | "),
  );
  const [reveals, setReveals] = useState<Record<string, string[]>>(
    initial?.reveals ?? {},
  );
  const [categoryUuids, setCategoryUuids] = useState<string[]>(
    initial?.categoryUuids ?? [],
  );

  // The option values that currently exist for this attribute: Yes/No for a
  // boolean, the parsed tokens for a select, nothing otherwise. These are the
  // values that can carry reveal links.
  const optionValues =
    inputType === "boolean"
      ? ["Yes", "No"]
      : inputType === "single_select" || inputType === "multi_select"
        ? optionsText.split("|").map((value) => value.trim()).filter(Boolean)
        : [];

  const revealOptions = revealTargets.map((target) => ({
    value: target.key,
    label: `${target.groupName} · ${target.label}`,
  }));

  const setRevealsFor = (optionValue: string, keys: string[]) =>
    setReveals((prev) => ({ ...prev, [optionValue]: keys }));

  const submit = () => {
    const options =
      inputType === "single_select" || inputType === "multi_select"
        ? optionsText.split("|").map((value) => value.trim()).filter(Boolean)
        : [];
    // Keep only reveal links whose option value still exists.
    const prunedReveals: Record<string, string[]> = {};
    for (const value of optionValues) {
      const keys = reveals[value]?.filter(Boolean) ?? [];
      if (keys.length > 0) {
        prunedReveals[value] = keys;
      }
    }
    onSubmit({
      groupUuid,
      label,
      inputType,
      unit: inputType === "number" ? unit : null,
      allowRange: inputType === "number" ? allowRange : false,
      options,
      reveals: prunedReveals,
      categoryUuids,
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-control border border-primary/40 bg-primary-tint/20 p-3">
      <div>
        <label className="text-xs font-semibold text-ink">Name</label>
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Attribute name"
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-ink">Type</label>
        <div className="mt-1">
          <Dropdown
            value={inputType}
            onChange={(value) => setInputType(value as SpecInputType)}
            options={INPUT_TYPES}
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-ink">Categories</label>
        <p className="mt-0.5 text-xs text-faint">
          Products in these categories (and their sub-categories) can use this
          attribute. Leave empty to make it available everywhere.
        </p>
        <div className="mt-1">
          <Dropdown
            multiple
            searchable
            value={categoryUuids}
            onChange={setCategoryUuids}
            placeholder="All categories"
            searchPlaceholder="Search categories…"
            options={categoryOptions}
          />
        </div>
      </div>
      {inputType === "number" && (
        <>
          <div>
            <label className="text-xs font-semibold text-ink">Unit</label>
            <Input
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="e.g. W"
              className="mt-1"
            />
          </div>
          <div className="flex flex-col gap-2 rounded-control border border-hairline bg-surface p-3">
            <Checkbox
              label="Range — the product enters a from–to pair"
              checked={allowRange}
              onChange={(event) => setAllowRange(event.target.checked)}
            />
            <p className="text-xs text-faint">
              Use this for spans like an input voltage range. Rules budget a
              range at its max when consuming and its min when providing.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-faint">Product sees:</span>
              {allowRange ? (
                <span className="flex items-center gap-1.5">
                  <span className="rounded-control border border-hairline bg-page px-2 py-1 text-xs text-faint">
                    From
                  </span>
                  <span className="text-xs text-faint">–</span>
                  <span className="rounded-control border border-hairline bg-page px-2 py-1 text-xs text-faint">
                    To {unit.trim()}
                  </span>
                </span>
              ) : (
                <span className="rounded-control border border-hairline bg-page px-2 py-1 text-xs text-faint">
                  0 {unit.trim()}
                </span>
              )}
            </div>
          </div>
        </>
      )}
      {(inputType === "single_select" || inputType === "multi_select") && (
        <div>
          <label className="text-xs font-semibold text-ink">
            Options — press space to separate
          </label>
          <Input
            value={optionsText}
            onChange={(event) => setOptionsText(toPipeSeparated(event.target.value))}
            placeholder="AC DC PoE Battery"
            className="mt-1"
          />
        </div>
      )}
      {inputType === "text" && (
        <div>
          <label className="text-xs font-semibold text-ink">
            Free-text field
          </label>
          <Textarea
            disabled
            rows={3}
            placeholder="A text attribute — the product fills this in as free text."
            className="mt-1"
          />
        </div>
      )}

      {optionValues.length > 0 && revealOptions.length > 0 && (
        <div className="flex flex-col gap-2 rounded-control border border-hairline bg-surface p-3">
          <div>
            <label className="text-xs font-semibold text-ink">
              Auto-add attributes
            </label>
            <p className="mt-0.5 text-xs text-faint">
              When a product picks an option below, the chosen attributes are
              added to it automatically (and removed if the option changes).
            </p>
          </div>
          {optionValues.map((value) => (
            <div key={value} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-secondary">
                {value}
              </span>
              <Dropdown
                multiple
                searchable
                value={reveals[value] ?? []}
                onChange={(keys) => setRevealsFor(value, keys)}
                placeholder="Nothing extra"
                searchPlaceholder="Search attributes…"
                options={revealOptions}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={pending}>
          {initial ? "Save changes" : "Add attribute"}
        </Button>
      </div>
    </div>
  );
};

export const LibraryBuilder = ({
  groups,
  categories,
}: LibraryBuilderProps) => {
  const router = useRouter();
  const categoryOptions = buildCategoryTreeOptions(categories);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);

  const realGroups = groups.filter((group) => group.uuid);

  // Every attribute in the library, flattened — the pool of reveal targets an
  // option can auto-add. Excludes the attribute itself at each call site.
  const allTargets: RevealTarget[] = groups.flatMap((group) =>
    group.attributes.map((attribute) => ({
      key: attribute.key,
      label: attribute.label,
      groupName: group.name,
    })),
  );
  const revealTargetsExcluding = (key?: string) =>
    allTargets.filter((target) => target.key !== key);

  const [selectedUuid, setSelectedUuid] = useState<string>(
    realGroups[0]?.uuid ?? "",
  );
  const selected =
    groups.find((group) => group.uuid === selectedUuid) ?? realGroups[0];

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDomain, setNewGroupDomain] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  // The inline group editor holds name + domain together, so saving one can
  // never blank the other.
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDomain, setGroupDomain] = useState("");
  const [addingAttribute, setAddingAttribute] = useState(false);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [movingUuid, setMovingUuid] = useState<string | null>(null);

  const run = (action: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(undefined);
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });

  const addGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    run(async () => {
      const result = await addGroupAction(name, newGroupDomain || null);
      if (!result.error) {
        setNewGroupName("");
        setNewGroupDomain("");
        setAddingGroup(false);
      }
      return result;
    });
  };

  const openGroupEditor = (group: LibraryBuilderGroup) => {
    setEditingGroup(true);
    setGroupName(group.name);
    setGroupDomain(group.domain ?? "");
  };

  const saveGroup = (uuid: string) =>
    run(async () => {
      const result = await updateGroupAction(
        uuid,
        groupName,
        groupDomain || null,
      );
      if (!result.error) {
        setEditingGroup(false);
      }
      return result;
    });

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= realGroups.length) return;
    const next = [...realGroups];
    [next[index], next[target]] = [next[target], next[index]];
    run(() => reorderGroupsAction(next.map((group) => group.uuid)));
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
        {/* Groups panel */}
        <div className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">
              Groups · {realGroups.length}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddingGroup((value) => !value)}
            >
              <Plus size={15} /> New group
            </Button>
          </div>

          {addingGroup && (
            <div className="flex flex-col gap-2 rounded-control border border-primary/40 bg-primary-tint/20 p-3">
              <Input
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="Group name"
                onKeyDown={(event) => event.key === "Enter" && addGroup()}
              />
              <Dropdown
                value={newGroupDomain}
                onChange={setNewGroupDomain}
                placeholder="No domain"
                options={DOMAIN_OPTIONS}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddingGroup(false)}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={addGroup} disabled={isPending}>
                  <Check size={15} /> Add group
                </Button>
              </div>
            </div>
          )}

          <ul className="flex flex-col gap-1">
            {realGroups.map((group, index) => {
              const isActive = group.uuid === selectedUuid;
              return (
                <li key={group.uuid}>
                  <div
                    className={`flex items-center gap-2 rounded-control px-3 py-2 ${
                      isActive
                        ? "bg-primary text-white"
                        : "text-secondary hover:bg-hover"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUuid(group.uuid);
                        setEditingGroup(false);
                        setAddingAttribute(false);
                        setEditingUuid(null);
                      }}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left text-sm"
                    >
                      <span className="min-w-0">
                        <span className="line-clamp-1 font-medium">
                          {group.name}
                        </span>
                        <span
                          className={`line-clamp-1 text-xs ${
                            isActive ? "text-white/70" : "text-faint"
                          }`}
                        >
                          {group.domain
                            ? (SPECIFICATION_DOMAIN_LABELS[
                                group.domain as SpecificationDomain
                              ] ?? group.domain)
                            : "No domain"}
                        </span>
                      </span>
                      <span
                        className={isActive ? "text-white/70" : "text-faint"}
                      >
                        {group.attributes.length}
                      </span>
                    </button>
                    {isActive && (
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0 || isPending}
                          aria-label="Move up"
                          className="rounded p-1 hover:bg-white/15 disabled:opacity-30"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === realGroups.length - 1 || isPending}
                          aria-label="Move down"
                          className="rounded p-1 hover:bg-white/15 disabled:opacity-30"
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openGroupEditor(group)}
                          aria-label="Edit group"
                          className="rounded p-1 hover:bg-white/15"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            run(() => deleteGroupAction(group.uuid))
                          }
                          aria-label="Delete group"
                          className="rounded p-1 hover:bg-white/15"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  {isActive && editingGroup && (
                    <div className="mt-1 flex flex-col gap-2 rounded-control border border-hairline bg-page p-3">
                      <div>
                        <label className="text-xs font-semibold text-ink">
                          Name
                        </label>
                        <Input
                          value={groupName}
                          onChange={(event) => setGroupName(event.target.value)}
                          className="mt-1"
                          onKeyDown={(event) =>
                            event.key === "Enter" && saveGroup(group.uuid)
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-ink">
                          Domain
                        </label>
                        <p className="mt-0.5 text-xs text-faint">
                          Buckets this group in the library and on the product
                          attribute picker.
                        </p>
                        <div className="mt-1">
                          <Dropdown
                            value={groupDomain}
                            onChange={setGroupDomain}
                            placeholder="No domain"
                            options={DOMAIN_OPTIONS}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setEditingGroup(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={() => saveGroup(group.uuid)}
                          disabled={isPending}
                        >
                          <Check size={15} /> Save
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Attributes panel */}
        <div className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">
              {selected ? selected.name : "Select a group"} ·{" "}
              {selected?.attributes.length ?? 0} attributes
            </span>
            {selected?.uuid && (
              <Button
                type="button"
                onClick={() => {
                  setAddingAttribute(true);
                  setEditingUuid(null);
                }}
              >
                <Plus size={15} /> Add attribute
              </Button>
            )}
          </div>

          {addingAttribute && selected?.uuid && (
            <AttributeForm
              groupUuid={selected.uuid}
              pending={isPending}
              revealTargets={revealTargetsExcluding()}
              categoryOptions={categoryOptions}
              onCancel={() => setAddingAttribute(false)}
              onSubmit={(input) =>
                run(async () => {
                  const result = await addAttributeAction(input);
                  if (!result.error) setAddingAttribute(false);
                  return result;
                })
              }
            />
          )}

          <ul className="flex flex-col divide-y divide-hairline">
            {(selected?.attributes ?? []).map((attribute) => (
              <li key={attribute.uuid} className="py-2.5">
                {editingUuid === attribute.uuid ? (
                  <AttributeForm
                    groupUuid={attribute.groupUuid}
                    pending={isPending}
                    revealTargets={revealTargetsExcluding(attribute.key)}
                    categoryOptions={categoryOptions}
                    initial={{
                      uuid: attribute.uuid,
                      groupUuid: attribute.groupUuid,
                      label: attribute.label,
                      inputType: attribute.inputType,
                      unit: attribute.unit,
                      allowRange: attribute.allowRange,
                      options: attribute.options,
                      reveals: attribute.optionReveals,
                      categoryUuids: attribute.categoryUuids,
                    }}
                    onCancel={() => setEditingUuid(null)}
                    onSubmit={(input) =>
                      run(async () => {
                        const result = await updateAttributeAction(
                          attribute.uuid,
                          input,
                        );
                        if (!result.error) setEditingUuid(null);
                        return result;
                      })
                    }
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <TypeIcon type={attribute.inputType} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="line-clamp-1 text-sm font-medium text-ink">
                          {attribute.label}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_META[attribute.inputType].className}`}
                        >
                          {TYPE_META[attribute.inputType].label}
                        </span>
                        {attribute.allowRange && (
                          <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                            range
                          </span>
                        )}
                        {attribute.relationshipCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            <GitCompare size={10} />
                            {attribute.relationshipCount}
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-1 text-xs text-faint">
                        {attribute.unit ? `${attribute.unit} · ` : ""}
                        {attribute.options.length > 0
                          ? `${attribute.options.slice(0, 4).join(", ")}${attribute.options.length > 4 ? " …" : ""} · `
                          : ""}
                        <span className="font-mono">{attribute.key}</span>
                      </p>
                      {movingUuid === attribute.uuid && (
                        <div className="mt-2 max-w-xs">
                          <Dropdown
                            value=""
                            onChange={(value) =>
                              run(async () => {
                                const result = await moveAttributeAction(
                                  attribute.uuid,
                                  value || null,
                                );
                                if (!result.error) setMovingUuid(null);
                                return result;
                              })
                            }
                            placeholder="Move to group…"
                            options={realGroups
                              .filter((group) => group.uuid !== selectedUuid)
                              .map((group) => ({
                                value: group.uuid,
                                label: group.name,
                              }))}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUuid(attribute.uuid);
                          setAddingAttribute(false);
                        }}
                        aria-label="Edit"
                        className="rounded-control border border-hairline p-1.5 text-secondary hover:bg-hover"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setMovingUuid((value) =>
                            value === attribute.uuid ? null : attribute.uuid,
                          )
                        }
                        aria-label="Move to another group"
                        className="rounded-control border border-hairline p-1.5 text-secondary hover:bg-hover"
                      >
                        {movingUuid === attribute.uuid ? (
                          <X size={14} />
                        ) : (
                          <span className="text-sm leading-none">→</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          run(() => deleteAttributeAction(attribute.uuid))
                        }
                        aria-label="Delete"
                        className="rounded-control border border-hairline p-1.5 text-secondary hover:bg-hover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
            {selected && selected.attributes.length === 0 && !addingAttribute && (
              <li className="py-6 text-center text-sm text-faint">
                No attributes in this group yet.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};
