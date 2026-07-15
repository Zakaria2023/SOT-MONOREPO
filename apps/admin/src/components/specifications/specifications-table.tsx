"use client";

import { SpecificationRowActions } from "@/components/specifications/specification-row-actions";
import { Table } from "ui";
import type { TableColumn } from "ui";
import type { SpecificationWithCategories } from "services";

type SpecificationsTableProps = {
  specifications: SpecificationWithCategories[];
};

const columns: TableColumn<SpecificationWithCategories>[] = [
  {
    key: "label",
    header: "Label",
    render: (specification) => (
      <span className="font-semibold text-ink">{specification.label}</span>
    ),
  },
  {
    key: "group",
    header: "Group",
    render: (specification) =>
      specification.groupName ? (
        <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium text-secondary">
          {specification.groupName}
        </span>
      ) : (
        <span className="text-faint">—</span>
      ),
  },
  {
    key: "options",
    header: "Values",
    render: (specification) =>
      specification.valueType === "number" ? (
        <span className="text-muted">
          Number{specification.unit ? ` (${specification.unit})` : ""}
          {(specification.options ?? []).length > 0 &&
            `: ${(specification.options ?? [])
              .map((option) => option.value)
              .join(", ")}`}
        </span>
      ) : (
        <span className="text-muted">
          {(specification.options ?? [])
            .map((option) => option.value)
            .join(", ") || "—"}
        </span>
      ),
  },
  {
    key: "categories",
    header: "Categories",
    render: (specification) =>
      specification.categoryNames.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {specification.categoryNames.map((name) => (
            <span
              key={name}
              className="rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary"
            >
              {name}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-faint">—</span>
      ),
  },
  {
    key: "actions",
    header: "Action",
    align: "right",
    render: (specification) => (
      <SpecificationRowActions
        uuid={specification.uuid}
        label={specification.label}
      />
    ),
  },
];

export const SpecificationsTable = ({
  specifications,
}: SpecificationsTableProps) => (
  <Table
    columns={columns}
    data={specifications}
    emptyMessage="No specifications yet."
  />
);
