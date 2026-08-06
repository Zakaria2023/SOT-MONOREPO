"use client";

import {
  addAttributeAction,
  addGroupAction,
  deleteAttributeAction,
  deleteGroupAction,
  reorderGroupsAction,
  updateAttributeAction,
  updateGroupAction,
} from "@/app/(dashboard)/library/action";
import type { LibraryGroup, OptionSet } from "services";

import type { SelectCategories } from "@/db/schema/categories";

import { buildCategoryTreeOptions } from "@/lib/categories";
import {
  ArrowDown,
  ArrowUp,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ConfirmDialog, type DropdownOption } from "ui";
import { domainLabel } from "@/components/library/library-shared";
import type {
  LibraryAttribute,
  SearchHit,
} from "@/components/library/library-shared";
import { GroupForm } from "./group-form";
import { AttributeForm } from "./attribute-form";
import { AttributeRow } from "./attribute-row";
type LibraryBuilderProps = {
  groups: LibraryGroup[];
  categories: SelectCategories[];
  // The shared vocabularies an attribute or a sub-field may point at instead of
  // owning its own list.
  sharedLists: OptionSet[];
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
              <h2 className="text-sm font-medium text-ink">Groups</h2>
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
              <h2 className="text-sm font-medium text-ink">
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
