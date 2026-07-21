"use client";

import { ClassificationRowActions } from "@/components/classifications/classification-row-actions";
import type { ClassificationListItem } from "@/app/(dashboard)/classifications/action";
import { Table } from "ui";
import type { TableColumn } from "ui";

type ClassificationsTableProps = {
  classifications: ClassificationListItem[];
};

const columns: TableColumn<ClassificationListItem>[] = [
  {
    key: "name",
    header: "Name",
    render: (classification) => (
      <span className="font-semibold text-ink">{classification.name}</span>
    ),
  },
  {
    key: "categoryCount",
    header: "Categories",
    render: (classification) => (
      <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium text-secondary">
        {classification.categoryCount}
      </span>
    ),
  },
  {
    key: "actions",
    header: "Action",
    align: "right",
    render: (classification) => (
      <ClassificationRowActions
        uuid={classification.uuid}
        name={classification.name}
      />
    ),
  },
];

export const ClassificationsTable = ({
  classifications,
}: ClassificationsTableProps) => (
  <Table
    columns={columns}
    data={classifications}
    emptyMessage="No classifications yet."
  />
);
