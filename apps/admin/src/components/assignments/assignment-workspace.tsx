"use client";

import {
  saveAssignments,
  type AssignmentInput,
  type CategoryAssignment,
  type SpecRelation,
  type SpecificationWithCategories,
} from "@/app/(dashboard)/assignments/actions";
import { AssignmentsTab } from "@/components/assignments/assignments-tab";
import { useState, useTransition } from "react";
import { Button, FormError } from "ui";

type AssignmentWorkspaceProps = {
  categoryUuid: string;
  categoryName: string;
  categoryPath: string | null;
  assignments: CategoryAssignment[];
  library: SpecificationWithCategories[];
  // Rules touching each assigned attribute, keyed by spec uuid.
  relations: Record<string, SpecRelation[]>;
};

// A row being edited. `owned` marks it as authored ON this category: only
// owned rows are saved, so an untouched inherited row keeps flowing from its
// ancestor and still tracks later changes made up there.
export type DraftRow = CategoryAssignment & {
  owned: boolean;
};

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
  relations,
}: AssignmentWorkspaceProps) => {
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
          <span className="font-mono text-sm text-faint">{categoryPath}</span>
        )}
        <h2 className="font-heading text-lg text-ink">{categoryName}</h2>
        <span className="ml-auto text-sm text-muted">
          {rows.length} carried · {ownedCount} authored here
        </span>
      </div>

      <AssignmentsTab
          rows={rows}
          library={library}
          relations={relations}
          onChange={patchRow}
          onReset={resetRow}
          onRemove={removeRow}
        onAdd={addRow}
      />

      <FormError message={error} />

      <div className="flex items-center justify-end gap-3 border-t border-hairline pt-4">
        {saved && (
          <span className="text-sm font-semibold text-primary">Saved.</span>
        )}
        <Button type="button" onClick={onSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save assignments"}
        </Button>
      </div>
    </div>
  );
};
