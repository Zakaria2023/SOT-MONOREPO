"use client";

import type { GovernmentRequestListItem } from "@/app/(dashboard)/government/action";
import { GovernmentRequestRowActions } from "@/components/government/government-request-row-actions";
import type { GovernmentRequestStatus } from "@/db/enum";
import { GOVERNMENT_REQUEST_STATUS_LABELS } from "@/db/label";
import type { TableColumn } from "ui";
import { Table } from "ui";

type GovernmentRequestsTableProps = {
  requests: GovernmentRequestListItem[];
};

const STATUS_BADGE_CLASSES: Record<GovernmentRequestStatus, string> = {
  pending: "bg-hover text-faint",
  approved: "bg-success-tint text-success",
  rejected: "bg-danger-tint text-danger",
};

const columns: TableColumn<GovernmentRequestListItem>[] = [
  {
    key: "entity",
    header: "Entity",
    render: (request) => (
      <div className="min-w-56 space-y-1">
        <p className="font-semibold text-ink">{request.entityName}</p>
        <p className="text-muted">
          {request.fullName} · {request.location}
        </p>
        <a href={`mailto:${request.officialEmail}`} className="text-primary">
          {request.officialEmail}
        </a>
        <p className="text-muted">{request.contactNumber}</p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (request) => (
      <div className="min-w-56 space-y-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[request.status]}`}
        >
          {GOVERNMENT_REQUEST_STATUS_LABELS[request.status]}
        </span>
        {request.rejectionReason && (
          <p className="whitespace-pre-wrap wrap-break-word text-sm text-muted">
            {request.rejectionReason}
          </p>
        )}
        {request.reviewedByName && (
          <p className="text-sm text-muted">
            Reviewed by {request.reviewedByName}
          </p>
        )}
      </div>
    ),
  },
  {
    key: "createdAt",
    header: "Submitted",
    render: (request) => (
      <div className="min-w-28 text-sm text-ink">
        {new Date(request.createdAt).toLocaleDateString()}
      </div>
    ),
  },
  {
    key: "actions",
    header: "Action",
    align: "right",
    render: (request) => <GovernmentRequestRowActions request={request} />,
  },
];

export const GovernmentRequestsTable = ({
  requests,
}: GovernmentRequestsTableProps) => (
  <Table
    columns={columns}
    data={requests}
    emptyMessage="No government requests yet."
  />
);
