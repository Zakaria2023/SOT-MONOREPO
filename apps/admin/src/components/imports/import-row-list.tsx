import { IMPORT_ROW_STATUS_LABELS } from "@/db/label";
import Link from "next/link";
import type { ImportRowSummary } from "services";
import type { TableColumn } from "ui";
import { Table } from "ui";

type ImportRowListProps = {
  rows: ImportRowSummary[];
};

const columns: TableColumn<ImportRowSummary>[] = [
  {
    key: "name",
    header: "Product",
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-medium text-ink">{row.name ?? "— unnamed —"}</span>
        <span className="font-mono text-xs text-faint">{row.sourceRef}</span>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) =>
      row.productUuid ? (
        <Link
          href={`/products/${row.productUuid}`}
          className="text-success hover:underline"
        >
          {IMPORT_ROW_STATUS_LABELS[row.status]}
        </Link>
      ) : (
        IMPORT_ROW_STATUS_LABELS[row.status]
      ),
  },
  {
    key: "open",
    header: "Waiting on",
    align: "right",
    // A row is committable exactly when this is zero. That is the gate, and it
    // is the only thing this list has to make obvious.
    render: (row) =>
      row.openIssues > 0 ? (
        <span className="text-danger">
          {row.openIssues} question{row.openIssues === 1 ? "" : "s"}
        </span>
      ) : (
        <span className="text-faint">Ready</span>
      ),
  },
];

export const ImportRowList = ({ rows }: ImportRowListProps) => (
  <Table columns={columns} data={rows} emptyMessage="Nothing was read." />
);
