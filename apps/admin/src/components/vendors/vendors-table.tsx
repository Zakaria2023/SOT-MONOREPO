"use client";

import type { VendorListItem } from "@/app/(dashboard)/vendors/action";
import { VendorRowActions } from "@/components/vendors/vendor-row-actions";
import type { VendorStatus } from "@/db/enum";
import { VENDOR_STATUS_LABELS } from "@/db/label";
import type { TableColumn } from "ui";
import { Table } from "ui";

type VendorsTableProps = {
  vendors: VendorListItem[];
};

const STATUS_BADGE_CLASSES: Record<VendorStatus, string> = {
  active: "bg-success-tint text-success",
  inactive: "bg-hover text-faint",
};

const columns: TableColumn<VendorListItem>[] = [
  {
    key: "name",
    header: "Name",
    render: (vendor) => (
      <span className="font-semibold text-ink">{vendor.name}</span>
    ),
  },
  {
    key: "parent",
    header: "Parent",
    render: (vendor) =>
      vendor.parentName ?? <span className="text-faint">—</span>,
  },
  {
    key: "idLabel",
    header: "ID Label",
    render: (vendor) => vendor.idLabel,
  },
  {
    key: "status",
    header: "Status",
    render: (vendor) => (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[vendor.status]}`}
      >
        {VENDOR_STATUS_LABELS[vendor.status]}
      </span>
    ),
  },
  {
    key: "notes",
    header: "Notes",
    render: (vendor) => (
      <span className="text-muted">{vendor.notes ?? "—"}</span>
    ),
  },
  {
    key: "actions",
    header: "Action",
    align: "right",
    render: (vendor) => (
      <VendorRowActions uuid={vendor.uuid} name={vendor.name} />
    ),
  },
];

export const VendorsTable = ({ vendors }: VendorsTableProps) => (
  <Table columns={columns} data={vendors} emptyMessage="No vendors yet." />
);
