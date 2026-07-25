"use client";

import {
  saveAssignments,
  type AssignmentInput,
  type CategoryAssignment,
  type ShopperPreview,
  type SpecRelation,
  type SpecificationWithCategories,
} from "@/app/(dashboard)/assignments/actions";
import { AssignmentsTab } from "@/components/assignments/assignments-tab";
import { ShopperPanelTab } from "@/components/assignments/shopper-panel-tab";
import type { AssignmentAudience } from "@/db/enum";
import { useState, useTransition } from "react";
import { Button, FormError } from "ui";

type AssignmentWorkspaceProps = {
  categoryUuid: string;
  categoryName: string;
  categoryPath: string | null;
  assignments: CategoryAssignment[];
  library: SpecificationWithCategories[];
  preview: ShopperPreview;
  // Rules touching each assigned attribute, keyed by spec uuid.
  relations: Record<string, SpecRelation[]>;
};

// A row being edited. `owned` marks it as authored ON this category: only
// owned rows are saved, so an untouched inherited row keeps flowing from its
// ancestor and still tracks later changes made up there.
export type DraftRow = CategoryAssignment & {
  owned: boolean;
};

// The product form preview lives on the real product form now, not here —
// this page is where assignments are authored, not where a product is filled
// in.
type Tab = "assignments" | "shopper";

const TABS: { value: Tab; label: string }[] = [
  { value: "assignments", label: "Assignments" },
  { value: "shopper", label: "Shopper panel" },
];

const AUDIENCES: { value: AssignmentAudience; label: string }[] = [
  { value: "all", label: "All" },
  { value: "partner", label: "Partner" },
  { value: "staff", label: "Staff" },
];

const toInput = (row: DraftRow): AssignmentInput => ({
  specificationUuid: row.specificationUuid,
  isFilter: row.isFilter,
  isRule: row.isRule,
  scope: row.scope,
  showIf: row.showIf,
  audience: row.audience,
  enabledValues: row.enabledValues,
  order: row.order,
});

export const AssignmentWorkspace = ({
  categoryUuid,
  categoryName,
  categoryPath,
  assignments,
  library,
  preview,
  relations,
}: AssignmentWorkspaceProps) => {
  const [tab, setTab] = useState<Tab>("assignments");
  // The preview tabs answer "what would this look like to…", so the audience
  // is a viewing lens here, not a setting.
  const [viewingAs, setViewingAs] = useState<AssignmentAudience>("all");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  const [rows, setRows] = useState<DraftRow[]>(
    assignments.map((assignment) => ({
      ...assignment,
      owned: !assignment.inherited,
    })),
  );

  const original = new Map(
    assignments.map((assignment) => [assignment.specificationUuid, assignment]),
  );

  // Editing any switch takes ownership of the row — that is what an override
  // is. Until then the row keeps flowing from the ancestor that authored it.
  const patchRow = (specificationUuid: string, patch: Partial<DraftRow>) => {
    setSaved(false);
    setRows((current) =>
      current.map((row) =>
        row.specificationUuid === specificationUuid
          ? { ...row, ...patch, owned: true }
          : row,
      ),
    );
  };

  const resetRow = (specificationUuid: string) => {
    setSaved(false);
    setRows((current) =>
      current.map((row) => {
        const source = original.get(specificationUuid);
        return row.specificationUuid === specificationUuid && source
          ? { ...source, owned: false }
          : row;
      }),
    );
  };

  const removeRow = (specificationUuid: string) => {
    setSaved(false);
    setRows((current) =>
      current.filter((row) => row.specificationUuid !== specificationUuid),
    );
  };

  const addRow = (specificationUuid: string) => {
    const specification = library.find(
      (item) => item.uuid === specificationUuid,
    );
    if (!specification) {
      return;
    }
    setSaved(false);
    setRows((current) => [
      ...current,
      {
        specificationUuid: specification.uuid,
        key: specification.key,
        label: specification.label,
        unit: specification.unit,
        ordered: specification.ordered,
        valueType: specification.valueType,
        inputType: specification.inputType,
        allowMultiple: specification.allowMultiple,
        masterOptions: (specification.options ?? []).map(
          (option) => option.value,
        ),
        offeredOptions: (specification.options ?? []).map(
          (option) => option.value,
        ),
        sourceCategoryUuid: categoryUuid,
        sourceCategoryName: categoryName,
        inherited: false,
        // Newly assigned attributes are alive for the engine but not yet a
        // shopper-facing filter — showing one is a deliberate second step.
        isFilter: false,
        isRule: true,
        scope: "branch",
        showIf: null,
        audience: "all",
        enabledValues: null,
        order: current.length,
        owned: true,
      },
    ]);
  };

  const onSave = () =>
    startTransition(async () => {
      const result = await saveAssignments(
        categoryUuid,
        rows.filter((row) => row.owned).map(toInput),
      );
      setError(result.error);
      setSaved(Boolean(result.success));
    });

  const ownedCount = rows.filter((row) => row.owned).length;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-5 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        {categoryPath && (
          <span className="font-mono text-xs text-faint">{categoryPath}</span>
        )}
        <h2 className="font-heading text-lg text-ink">{categoryName}</h2>
        <span className="ml-auto text-xs text-muted">
          {rows.length} carried · {ownedCount} authored here
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-hairline pb-4">
        {TABS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => setTab(entry.value)}
            aria-pressed={tab === entry.value}
            className={
              tab === entry.value
                ? "rounded-control bg-primary-tint px-4 py-2 text-sm font-semibold text-primary"
                : "rounded-control border border-hairline px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-primary hover:text-primary"
            }
          >
            {entry.label}
          </button>
        ))}

        {tab !== "assignments" && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-muted">Viewing as</span>
            {AUDIENCES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => setViewingAs(entry.value)}
                aria-pressed={viewingAs === entry.value}
                className={
                  viewingAs === entry.value
                    ? "rounded-control bg-primary px-2.5 py-1.5 text-xs font-semibold text-white"
                    : "rounded-control border border-hairline px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-primary hover:text-primary"
                }
              >
                {entry.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "assignments" && (
        <AssignmentsTab
          rows={rows}
          library={library}
          relations={relations}
          onChange={patchRow}
          onReset={resetRow}
          onRemove={removeRow}
          onAdd={addRow}
        />
      )}

      {tab === "shopper" && (
        <ShopperPanelTab
          rows={rows}
          preview={preview}
          viewingAs={viewingAs}
        />
      )}

      <FormError message={error} />

      {tab === "assignments" && (
        <div className="flex items-center justify-end gap-3 border-t border-hairline pt-4">
          {saved && (
            <span className="text-xs font-semibold text-primary">Saved.</span>
          )}
          <Button type="button" onClick={onSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save assignments"}
          </Button>
        </div>
      )}
    </div>
  );
};
