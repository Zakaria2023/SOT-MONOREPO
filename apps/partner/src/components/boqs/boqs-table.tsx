"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { PartnerBoqListItem } from "services";
import { Table } from "ui";
import type { TableColumn } from "ui";

type BoqsTableProps = {
  boqs: PartnerBoqListItem[];
};

const COLUMNS: TableColumn<PartnerBoqListItem>[] = [
  {
    key: "reference",
    header: "Reference",
    render: (boq) => (
      <span className="font-semibold text-ink">{boq.reference}</span>
    ),
  },
  {
    key: "match",
    header: "Match",
    render: (boq) => (
      <span className="rounded-full bg-primary-tint px-2 py-0.5 text-xs font-semibold text-primary">
        #{boq.matchRank}
      </span>
    ),
  },
  {
    key: "sent",
    header: "Sent",
    align: "right",
    render: (boq) => new Date(boq.dispatchedAt).toLocaleDateString(),
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
        Open
        <ArrowRight size={14} />
      </Link>
    ),
  },
];

export const BoqsTable = ({ boqs }: BoqsTableProps) => (
  <Table columns={COLUMNS} data={boqs} emptyMessage="No BOQs sent to you yet." />
);
