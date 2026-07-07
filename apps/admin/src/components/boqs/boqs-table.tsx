"use client";

import type { PreSellerOption } from "@/app/(dashboard)/boqs/action";
import { AssignPreSeller } from "@/components/boqs/assign-pre-seller";
import { Table } from "ui";
import type { TableColumn } from "ui";
import type { BoqStatus } from "@/lib/enum";
import { formatSar } from "@/lib/helpers";
import { BOQ_STATUS_LABELS } from "@/lib/label";
import type { BoqListItem } from "services";

type BoqsTableProps = {
  boqs: BoqListItem[];
  preSellers: PreSellerOption[];
};

const STATUS_BADGE_CLASSES: Record<BoqStatus, string> = {
  draft: "bg-hover text-faint",
  submitted: "bg-warning-tint text-warning",
  reviewed: "bg-success-tint text-success",
};

const buildColumns = (
  preSellers: PreSellerOption[],
): TableColumn<BoqListItem>[] => [
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
    render: (boq) => formatSar(boq.subtotal),
  },
  {
    key: "status",
    header: "Status",
    render: (boq) => (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[boq.status]}`}
      >
        {BOQ_STATUS_LABELS[boq.status]}
      </span>
    ),
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
];

export const BoqsTable = ({ boqs, preSellers }: BoqsTableProps) => (
  <Table
    columns={buildColumns(preSellers)}
    data={boqs}
    emptyMessage="No BOQs yet."
  />
);
