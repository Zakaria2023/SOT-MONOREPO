"use client";

import { answerIssueGroup } from "@/app/(dashboard)/imports/action";
import { IMPORT_ISSUE_TYPE_LABELS } from "@/db/label";
import { Check, Plus, X } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import type { IssueGroup } from "services";
import type { SpecOption } from "@/db/types";
import { Button, Dropdown, FormError, Input } from "ui";

type IssueGroupCardProps = {
  batchUuid: string;
  group: IssueGroup;
  // The attribute's master list, so mapping onto an existing value is a pick
  // rather than typing — the one habit that keeps the list from forking.
  options: SpecOption[];
};

export const IssueGroupCard = ({
  batchUuid,
  group,
  options,
}: IssueGroupCardProps) => {
  const [state, dispatch, isPending] = useActionState(
    answerIssueGroup.bind(null, batchUuid),
    {},
  );
  const [mapped, setMapped] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const answer = (
    status: "approved" | "corrected" | "rejected",
    extra: { option?: string; newOptionLabel?: string } = {},
  ) =>
    startTransition(() => {
      dispatch({ groupKey: group.groupKey, status, ...extra });
    });

  const proposed = group.proposedValue?.option ?? group.proposedValue?.note;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-control bg-danger-tint px-2 py-1 text-xs font-medium text-danger">
          {IMPORT_ISSUE_TYPE_LABELS[group.type]}
        </span>
        {group.attributeLabel && (
          <span className="text-sm text-ink">{group.attributeLabel}</span>
        )}
        {/* The number that earns the grouping. One answer clears all of these. */}
        <span className="ml-auto text-sm font-medium text-faint">
          {group.affectedRows} product{group.affectedRows === 1 ? "" : "s"}
        </span>
      </div>

      {/* Source beside proposal. The question a reviewer is really answering is
          "did the parser read this right", which is unanswerable without the
          original — so the original is never summarised or trimmed away. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs uppercase text-faint">In the source</p>
          <p className="rounded-control bg-hover px-3 py-2 font-mono text-sm text-ink">
            {group.sourceText}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase text-faint">Read as</p>
          <p className="rounded-control bg-hover px-3 py-2 font-mono text-sm text-ink">
            {proposed ?? "— nothing the parser would commit to —"}
          </p>
        </div>
      </div>

      {options.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">
              Map onto an existing value
            </span>
            <Dropdown
              value={mapped}
              onChange={setMapped}
              placeholder="Pick from the master list"
              options={options.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isPending || !mapped}
            onClick={() => answer("corrected", { option: mapped })}
          >
            <Check size={15} />
            Use this
          </Button>
        </div>
      )}

      {group.specificationUuid && (
        <div className="flex flex-wrap items-end gap-3 border-t border-hairline pt-4">
          <div className="min-w-56 flex-1">
            <Input
              label="Or add it as a new value"
              placeholder={group.sourceText ?? ""}
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isPending || !newLabel.trim()}
            onClick={() =>
              answer("corrected", { newOptionLabel: newLabel.trim() })
            }
          >
            <Plus size={15} />
            Add to master list
          </Button>
        </div>
      )}

      <FormError message={state.error} />

      <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
        {proposed && (
          <Button
            type="button"
            disabled={isPending}
            onClick={() => answer("approved")}
          >
            <Check size={15} />
            Accept the reading
          </Button>
        )}
        {/* Rejecting leaves the field EMPTY, which is a real answer. Empty is
            empty — never zero, never "N/A". */}
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => answer("rejected")}
        >
          <X size={15} />
          Leave it empty
        </Button>
      </div>
    </div>
  );
};
