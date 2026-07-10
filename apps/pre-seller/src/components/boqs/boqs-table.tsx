"use client";

import { formatMoney } from "utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { BoqListItem } from "services";
import { Table } from "ui";
import type { TableColumn } from "ui";

type BoqsTableProps = {
  boqs: BoqListItem[];
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  draft: "bg-hover text-faint",
  submitted: "bg-warning-tint text-warning",
  reviewed: "bg-success-tint text-success",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Awaiting review",
  submitted: "Sent to partners",
  reviewed: "Reviewed",
};

const COLUMNS: TableColumn<BoqListItem>[] = [
  {
    key: "reference",
    header: "Reference",
    render: (boq) => (
      <span className="font-semibold text-ink">{boq.reference}</span>
    ),
  },
  {
    key: "customer",
    header: "Customer",
    render: (boq) => boq.customerName ?? <span className="text-faint">—</span>,
  },
  {
    key: "items",
    header: "Items",
    align: "right",
    render: (boq) => boq.itemCount,
  },
  {
    key: "value",
    header: "Value",
    align: "right",
    render: (boq) => formatMoney(boq.subtotal, "SAR"),
  },
  {
    key: "status",
    header: "Status",
    render: (boq) => {
      const status = boq.status ?? "draft";
      return (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            STATUS_BADGE_CLASSES[status] ?? "bg-hover text-faint"
          }`}
        >
          {STATUS_LABELS[status] ?? status}
        </span>
      );
    },
  },
  {
    key: "created",
    header: "Created",
    align: "right",
    render: (boq) => new Date(boq.createdAt).toLocaleDateString(),
  },
  {
    key: "action",
    header: "",
    align: "right",
    render: (boq) => (
      <Link
        href={`/boqs/${boq.uuid}`}
        className="inline-flex items-center gap-1.5 rounded-control bg-primary-tint px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-tint-border"
      >
        Review
        <ArrowRight size={14} />
      </Link>
    ),
  },
];

export const BoqsTable = ({ boqs }: BoqsTableProps) => (
  <Table columns={COLUMNS} data={boqs} emptyMessage="No BOQs assigned to you yet." />
);
