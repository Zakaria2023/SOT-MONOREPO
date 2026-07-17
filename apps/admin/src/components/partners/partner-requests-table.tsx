"use client";

import type { PartnerRequestListItem } from "@/app/(dashboard)/partners/action";
import { PartnerRequestDetailsDialog } from "@/components/partners/partner-request-details-dialog";
import { PartnerRequestRowActions } from "@/components/partners/partner-request-row-actions";
import type { PartnerRequestStatus } from "@/db/enum";
import {
  PARTNER_REQUEST_STATUS_LABELS,
  PARTNER_TYPE_LABELS,
} from "@/db/label";
import { Eye } from "lucide-react";
import { useState } from "react";
import type { TableColumn } from "ui";
import { Button, Table } from "ui";
import { PARTNER_CAPABILITY_LABELS, type PartnerCapability } from "validators";

type PartnerRequestsTableProps = {
  requests: PartnerRequestListItem[];
};

type DetailsCellProps = {
  request: PartnerRequestListItem;
};

const STATUS_BADGE_CLASSES: Record<PartnerRequestStatus, string> = {
  pending: "bg-hover text-faint",
  approved: "bg-success-tint text-success",
  rejected: "bg-danger-tint text-danger",
};

// The table shows only the shared fields — the dialog has the full record.
const DetailsCell = ({ request }: DetailsCellProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="px-3"
        onClick={() => setOpen(true)}
      >
        <Eye size={15} />
        Details
      </Button>
      {open && (
        <PartnerRequestDetailsDialog
          request={request}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

const columns: TableColumn<PartnerRequestListItem>[] = [
  {
    key: "name",
    header: "Name",
    render: (request) => (
      <div className="min-w-48 space-y-1">
        <p className="font-semibold text-ink">
          {request.companyName ?? request.fullName}
        </p>
        {request.companyName && (
          <p className="text-muted">{request.fullName}</p>
        )}
      </div>
    ),
  },
  {
    key: "type",
    header: "Type",
    render: (request) => (
      <span className="inline-flex rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary">
        {PARTNER_TYPE_LABELS[request.type]}
      </span>
    ),
  },
  {
    key: "capabilities",
    header: "Capabilities",
    render: (request) => {
      const capabilities = (request.capabilities ?? []) as PartnerCapability[];
      if (capabilities.length === 0) {
        return <span className="text-faint">—</span>;
      }
      return (
        <div className="flex min-w-44 flex-wrap gap-1">
          {capabilities.map((capability) => (
            <span
              key={capability}
              className="inline-flex rounded-full bg-hover px-2 py-0.5 text-xs text-muted"
            >
              {PARTNER_CAPABILITY_LABELS[capability]}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    key: "contact",
    header: "Contact",
    render: (request) => (
      <div className="min-w-48 space-y-1">
        <a href={`mailto:${request.email}`} className="text-primary">
          {request.email}
        </a>
        {request.contactNumber && (
          <p className="text-muted">{request.contactNumber}</p>
        )}
      </div>
    ),
  },
  {
    key: "location",
    header: "Location",
    render: (request) => (
      <span className="text-muted">{request.location}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (request) => (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[request.status]}`}
      >
        {PARTNER_REQUEST_STATUS_LABELS[request.status]}
      </span>
    ),
  },
  {
    key: "createdAt",
    header: "Submitted",
    render: (request) => (
      <div className="min-w-24 text-sm text-ink">
        {new Date(request.createdAt).toLocaleDateString()}
      </div>
    ),
  },
  {
    key: "details",
    header: "Details",
    render: (request) => <DetailsCell request={request} />,
  },
  {
    key: "actions",
    header: "Action",
    align: "right",
    render: (request) => <PartnerRequestRowActions request={request} />,
  },
];

export const PartnerRequestsTable = ({
  requests,
}: PartnerRequestsTableProps) => (
  <Table
    columns={columns}
    data={requests}
    emptyMessage="No partner requests yet."
  />
);
