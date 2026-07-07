"use client";

import type { PartnerRequestListItem } from "@/app/(dashboard)/partners/action";
import { PartnerRequestRowActions } from "@/components/partners/partner-request-row-actions";
import type { PartnerRequestStatus } from "@/lib/enum";
import {
  PARTNER_REQUEST_STATUS_LABELS,
  PARTNER_SERVICE_SCOPE_LABELS,
} from "@/lib/label";
import { Table } from "ui";
import type { TableColumn } from "ui";
import type { PartnerServiceScope } from "validators";

type PartnerRequestsTableProps = {
  requests: PartnerRequestListItem[];
};

const STATUS_BADGE_CLASSES: Record<PartnerRequestStatus, string> = {
  pending: "bg-hover text-faint",
  approved: "bg-success-tint text-success",
  rejected: "bg-danger-tint text-danger",
};

const columns: TableColumn<PartnerRequestListItem>[] = [
  {
    key: "applicant",
    header: "Applicant",
    render: (request) => (
      <div className="min-w-56 space-y-1">
        <p className="font-semibold text-ink">{request.fullName}</p>
        <p className="text-muted">{request.companyName}</p>
        <a href={`mailto:${request.email}`} className="text-primary">
          {request.email}
        </a>
        <p className="text-muted">{request.location ?? "-"}</p>
        <p className="text-xs text-faint">
          {PARTNER_SERVICE_SCOPE_LABELS[
            request.serviceScope as PartnerServiceScope
          ] ?? request.serviceScope}
        </p>
      </div>
    ),
  },
  {
    key: "details",
    header: "Details",
    render: (request) => (
      <div className="min-w-96 space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wide text-faint uppercase">
            About
          </p>
          <p className="whitespace-pre-wrap wrap-break-word text-sm text-ink">
            {request.about ?? "-"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wide text-faint uppercase">
            Offer
          </p>
          <p className="whitespace-pre-wrap wrap-break-word text-sm text-ink">
            {request.offer ?? "-"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wide text-faint uppercase">
            Special
          </p>
          <p className="whitespace-pre-wrap wrap-break-word text-sm text-ink">
            {request.special ?? "-"}
          </p>
        </div>
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
          {PARTNER_REQUEST_STATUS_LABELS[request.status]}
        </span>
        {request.rejectionReason && (
          <p className="whitespace-pre-wrap wrap-break-word text-sm text-muted">
            {request.rejectionReason}
          </p>
        )}
        {request.approvedClerkUserId && (
          <p className="text-sm text-muted">
            Clerk user: {request.approvedClerkUserId}
          </p>
        )}
        {request.reviewedByName && (
          <p className="text-sm text-muted">Reviewed by {request.reviewedByName}</p>
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
