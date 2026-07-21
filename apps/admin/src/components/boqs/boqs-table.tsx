"use client";

import type { PreSellerOption } from "@/app/(dashboard)/boqs/action";
import { AssignPreSeller } from "@/components/boqs/assign-pre-seller";
import type { BoqStatus } from "@/db/enum";
import { BOQ_STATUS_LABELS } from "@/db/label";
import { Eye } from "lucide-react";
import Link from "next/link";
import { formatSar } from "utils";
import type { BoqListItem } from "services";
import type { TableColumn } from "ui";
import { Table } from "ui";

type BoqsTableProps = {
  boqs: BoqListItem[];
  preSellers: PreSellerOption[];
};

const STATUS_BADGE_CLASSES: Record<BoqStatus, string> = {
  draft: "bg-hover text-faint",
  validated: "bg-primary-tint text-primary",
  submitted: "bg-warning-tint text-warning",
  reviewed: "bg-success-tint text-success",
  offered: "bg-primary-tint text-primary",
  ordered: "bg-success-tint text-success",
  assigned: "bg-primary-tint text-primary",
  installing: "bg-warning-tint text-warning",
  installed: "bg-primary-tint text-primary",
  verified: "bg-success-tint text-success",
  handed_over: "bg-success-tint text-success",
};

const buildColumns = (
  preSellers: PreSellerOption[],
): TableColumn<BoqListItem>[] => [
  {
    key: "reference",
    header: "Reference",
    render: (boq) => (
      <Link
        href={`/boqs/${boq.uuid}`}
        className="font-semibold text-primary hover:underline"
      >
        {boq.reference}
      </Link>
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
    render: (boq) => formatSar(boq.subtotal),
  },
  {
    key: "status",
    header: "Status",
    render: (boq) => {
      const status = boq.status ?? "draft";
      return (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[status]}`}
        >
          {BOQ_STATUS_LABELS[status]}
        </span>
      );
    },
  },
  {
    key: "assigned",
    header: "Assigned pre-seller",
    render: (boq) => (
      <AssignPreSeller
        boqUuid={boq.uuid}
        assignedId={boq.assignedPreSellerId}
        preSellers={preSellers}
      />
    ),
  },
  {
    key: "submitted",
    header: "Submitted",
    align: "right",
    render: (boq) =>
      boq.submittedAt ? (
        new Date(boq.submittedAt).toLocaleDateString()
      ) : (
        <span className="text-faint">—</span>
      ),
  },
  {
    key: "actions",
    header: "",
    align: "right",
    render: (boq) => (
      <Link
        href={`/boqs/${boq.uuid}`}
        className="inline-flex items-center gap-1.5 rounded-control border border-hairline px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-hover"
      >
        <Eye size={14} />
        View
      </Link>
    ),
  },
];

export const BoqsTable = ({ boqs, preSellers }: BoqsTableProps) => (
  <Table
    columns={buildColumns(preSellers)}
    data={boqs}
    emptyMessage="No BOQs yet."
  />
);
