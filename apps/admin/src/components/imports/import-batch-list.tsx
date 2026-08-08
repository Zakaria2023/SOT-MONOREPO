import { IMPORT_BATCH_STATUS_LABELS } from "@/db/label";
import Link from "next/link";
import { listImportBatches, type ImportBatchSummary } from "services";
import type { TableColumn } from "ui";
import { Table } from "ui";

const columns: TableColumn<ImportBatchSummary>[] = [
  {
    key: "source",
    header: "Source",
    render: (batch) => (
      <Link
        href={`/imports/${batch.uuid}`}
        className="font-medium text-ink hover:text-primary"
      >
        {batch.source}
      </Link>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (batch) => IMPORT_BATCH_STATUS_LABELS[batch.status],
  },
  {
    key: "rows",
    header: "Products",
    align: "right",
    render: (batch) => batch.rows,
  },
  {
    key: "open",
    header: "Waiting on you",
    align: "right",
    // The only number that decides what to do next. Zero is the interesting
    // value — it means the batch is ready to commit.
    render: (batch) =>
      batch.openIssues > 0 ? (
        <span className="font-medium text-danger">
          {batch.openIssues} question{batch.openIssues === 1 ? "" : "s"}
        </span>
      ) : (
        <span className="text-faint">Nothing</span>
      ),
  },
];

export const ImportBatchList = async () => {
  const batches = await listImportBatches();

  return (
    <Table
      columns={columns}
      data={batches}
      emptyMessage="No imports yet. Start one and every product it reads waits here until somebody has answered what the parser could not."
    />
  );
};
