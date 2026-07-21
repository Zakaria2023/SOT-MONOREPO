"use client";

import {
  addAttributeAction,
  addGroupAction,
  deleteAttributeAction,
  deleteGroupAction,
  moveAttributeAction,
  renameGroupAction,
  reorderGroupsAction,
  updateAttributeAction,
  type AttributeInput,
  type LibraryBuilderGroup,
} from "@/app/(dashboard)/library/action";
import type { SpecInputType } from "@/db/enum";
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
import { Button, Dropdown, Input } from "ui";

type LibraryBuilderProps = {
  groups: LibraryBuilderGroup[];
};

type AttributeFormProps = {
  groupUuid: string | null;
  initial?: AttributeInput & { uuid: string };
  onSubmit: (input: AttributeInput) => void;
  onCancel: () => void;
  pending: boolean;
};

const INPUT_TYPES: { value: SpecInputType; label: string }[] = [
  { value: "number", label: "Number" },
  { value: "single_select", label: "Single-select" },
  { value: "multi_select", label: "Multi-select" },
  { value: "boolean", label: "Yes / No" },
  { value: "text", label: "Text" },
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
  onSubmit,
  onCancel,
  pending,
}: AttributeFormProps) => {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [inputType, setInputType] = useState<SpecInputType>(
    initial?.inputType ?? "single_select",
  );
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [optionsText, setOptionsText] = useState(
    (initial?.options ?? []).join("|"),
  );

  const submit = () => {
    onSubmit({
      groupUuid,
      label,
      inputType,
      unit: inputType === "number" ? unit : null,
      options:
        inputType === "single_select" || inputType === "multi_select"
          ? optionsText.split("|").map((value) => value.trim()).filter(Boolean)
          : [],
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
      {inputType === "number" && (
        <div>
          <label className="text-xs font-semibold text-ink">Unit</label>
          <Input
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="e.g. W"
            className="mt-1"
          />
        </div>
      )}
      {(inputType === "single_select" || inputType === "multi_select") && (
        <div>
          <label className="text-xs font-semibold text-ink">
            Options — separate with |
          </label>
          <Input
            value={optionsText}
            onChange={(event) => setOptionsText(event.target.value)}
            placeholder="AC|Built-in AC|DC|PoE"
            className="mt-1"
          />
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

export const LibraryBuilder = ({ groups }: LibraryBuilderProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);

  const realGroups = groups.filter((group) => group.uuid);
  const [selectedUuid, setSelectedUuid] = useState<string>(
    realGroups[0]?.uuid ?? "",
  );
  const selected =
    groups.find((group) => group.uuid === selectedUuid) ?? realGroups[0];

  const [newGroupName, setNewGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [renamingGroup, setRenamingGroup] = useState(false);
  const [renameValue, setRenameValue] = useState("");
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
      const result = await addGroupAction(name);
      if (!result.error) {
        setNewGroupName("");
        setAddingGroup(false);
      }
      return result;
    });
  };

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
            <div className="flex items-center gap-2">
              <Input
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="Group name"
                onKeyDown={(event) => event.key === "Enter" && addGroup()}
              />
              <Button type="button" onClick={addGroup} disabled={isPending}>
                <Check size={15} />
              </Button>
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
                        setRenamingGroup(false);
                        setAddingAttribute(false);
                        setEditingUuid(null);
                      }}
                      className="flex flex-1 items-center justify-between gap-2 text-left text-sm"
                    >
                      <span className="line-clamp-1 font-medium">
                        {group.name}
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
                          onClick={() => {
                            setRenamingGroup(true);
                            setRenameValue(group.name);
                          }}
                          aria-label="Rename"
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
                  {isActive && renamingGroup && (
                    <div className="mt-1 flex items-center gap-2">
                      <Input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                      />
                      <Button
                        type="button"
                        onClick={() =>
                          run(async () => {
                            const result = await renameGroupAction(
                              group.uuid,
                              renameValue,
                            );
                            if (!result.error) setRenamingGroup(false);
                            return result;
                          })
                        }
                        disabled={isPending}
                      >
                        <Check size={15} />
                      </Button>
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
                    initial={{
                      uuid: attribute.uuid,
                      groupUuid: attribute.groupUuid,
                      label: attribute.label,
                      inputType: attribute.inputType,
                      unit: attribute.unit,
                      options: attribute.options,
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
