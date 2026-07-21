"use client";

import {
  createGroupAction,
  deleteGroupAction,
  reorderGroupsAction,
  updateGroupAction,
} from "@/app/(dashboard)/specifications/groups/action";
import { specificationDomains } from "@/db/enum";
import { SPECIFICATION_DOMAIN_LABELS } from "@/db/label";
import type { SelectSpecificationGroups } from "services";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, ConfirmDialog, Dropdown, Input } from "ui";

type GroupsManagerProps = {
  groups: SelectSpecificationGroups[];
};

const DOMAIN_OPTIONS = [
  { value: "", label: "No domain" },
  ...specificationDomains.map((domain) => ({
    value: domain,
    label: SPECIFICATION_DOMAIN_LABELS[domain],
  })),
];

export const GroupsManager = ({ groups }: GroupsManagerProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(groups);
  const [prevGroups, setPrevGroups] = useState(groups);
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [pendingDelete, setPendingDelete] =
    useState<SelectSpecificationGroups | null>(null);

  // Re-sync local state when the server sends fresh groups (after a refresh).
  if (groups !== prevGroups) {
    setPrevGroups(groups);
    setItems(groups);
  }

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
    const name = newName.trim();
    if (!name) {
      return;
    }
    run(async () => {
      const result = await createGroupAction(name, newDomain || null);
      if (!result.error) {
        setNewName("");
        setNewDomain("");
      }
      return result;
    });
  };

  const rename = (group: SelectSpecificationGroups, name: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.uuid === group.uuid ? { ...item, name } : item,
      ),
    );
  };

  const saveName = (group: SelectSpecificationGroups) => {
    const current = items.find((item) => item.uuid === group.uuid);
    if (!current || current.name.trim() === group.name) {
      return;
    }
    run(() =>
      updateGroupAction(group.uuid, current.name, current.domain ?? null),
    );
  };

  const changeDomain = (group: SelectSpecificationGroups, domain: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.uuid === group.uuid ? { ...item, domain: domain || null } : item,
      ),
    );
    run(() => updateGroupAction(group.uuid, group.name, domain || null));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) {
      return;
    }
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    run(() => reorderGroupsAction(next.map((item) => item.uuid)));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-5 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-sm font-semibold text-ink">New group</label>
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="e.g. Camera"
            className="mt-1.5"
          />
        </div>
        <div className="sm:w-64">
          <label className="text-sm font-semibold text-ink">Domain</label>
          <div className="mt-1.5">
            <Dropdown
              value={newDomain}
              onChange={setNewDomain}
              options={DOMAIN_OPTIONS}
            />
          </div>
        </div>
        <Button type="button" onClick={addGroup} disabled={isPending}>
          <Plus size={16} />
          Add group
        </Button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-col divide-y divide-hairline rounded-card border border-hairline bg-surface">
        {items.length === 0 ? (
          <p className="p-6 text-center text-sm text-faint">No groups yet.</p>
        ) : (
          items.map((group, index) => (
            <div
              key={group.uuid}
              className="flex flex-wrap items-center gap-3 p-4"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || isPending}
                  aria-label="Move up"
                  className="text-faint hover:text-primary disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1 || isPending}
                  aria-label="Move down"
                  className="text-faint hover:text-primary disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
              </div>

              <div className="min-w-48 flex-1">
                <Input
                  value={group.name}
                  onChange={(event) => rename(group, event.target.value)}
                  onBlur={() => saveName(group)}
                />
              </div>

              <div className="w-56">
                <Dropdown
                  value={group.domain ?? ""}
                  onChange={(value) => changeDomain(group, value)}
                  options={DOMAIN_OPTIONS}
                />
              </div>

              <Button
                type="button"
                variant="icon"
                className="h-9 w-9"
                onClick={() => setPendingDelete(group)}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete group"
        description={
          pendingDelete
            ? `Delete "${pendingDelete.name}"? Its attributes are kept but become ungrouped.`
            : ""
        }
        confirmLabel="Delete"
        isConfirming={isPending}
        onConfirm={() => {
          if (pendingDelete) {
            const uuid = pendingDelete.uuid;
            setPendingDelete(null);
            run(() => deleteGroupAction(uuid));
          }
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
