"use client";

import type { OfferRow } from "@/app/(dashboard)/offers/action";
import { OfferRowActions } from "@/components/offers/offer-row-actions";
import type { OfferStatus } from "@/db/enum";
import { OFFER_STATUS_LABELS, PARTNER_SERVICE_SCOPE_LABELS } from "@/db/label";
import { formatSar, offerTotal } from "utils";
import type { TableColumn } from "ui";
import { Table } from "ui";
import type { PartnerServiceScope } from "validators";

type OffersTableProps = {
  offers: OfferRow[];
};

const STATUS_BADGE_CLASSES: Record<OfferStatus, string> = {
  pending: "bg-warning-tint text-warning",
  approved: "bg-success-tint text-success",
  rejected: "bg-danger-tint text-danger",
  selected: "bg-primary-tint text-primary",
};

const columns: TableColumn<OfferRow>[] = [
  {
    key: "offer",
    header: "Offer",
    render: (offer) => (
      <div className="min-w-56 space-y-1">
        <p className="font-semibold text-ink">{offer.partnerName ?? "—"}</p>
        <p className="text-xs text-faint">
          {PARTNER_SERVICE_SCOPE_LABELS[
            offer.serviceScope as PartnerServiceScope
          ] ?? offer.serviceScope}
        </p>
        <p className="text-muted">{offer.boqReference ?? "—"}</p>
        <p className="text-muted">{offer.customerName ?? "—"}</p>
      </div>
    ),
  },
  {
    key: "pricing",
    header: "Pricing",
    render: (offer) => (
      <div className="min-w-44 space-y-1 text-sm">
        <div className="flex justify-between gap-6">
          <span className="text-muted">Product</span>
          <span className="text-ink">
            {formatSar(Number(offer.productPrice))}
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted">Install</span>
          <span className="text-ink">
            {formatSar(Number(offer.installPrice))}
          </span>
        </div>
        {offer.programmingPrice && (
          <div className="flex justify-between gap-6">
            <span className="text-muted">Programming</span>
            <span className="text-ink">
              {formatSar(Number(offer.programmingPrice))}
            </span>
          </div>
        )}
        <div className="flex justify-between gap-6 border-t border-hairline pt-1">
          <span className="font-semibold text-ink">Total</span>
          <span className="font-semibold text-ink">
            {formatSar(offerTotal(offer))}
          </span>
        </div>
      </div>
    ),
  },
  {
    key: "description",
    header: "Description",
    render: (offer) => (
      <p className="min-w-72 whitespace-pre-wrap wrap-break-word text-sm text-ink">
        {offer.description}
      </p>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (offer) => (
      <div className="min-w-48 space-y-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[offer.status]}`}
        >
          {OFFER_STATUS_LABELS[offer.status]}
        </span>
        {offer.rejectionReason && (
          <p className="whitespace-pre-wrap wrap-break-word text-sm text-muted">
            {offer.rejectionReason}
          </p>
        )}
        {offer.reviewedByName && (
          <p className="text-sm text-muted">
            Reviewed by {offer.reviewedByName}
          </p>
        )}
      </div>
    ),
  },
  {
    key: "createdAt",
    header: "Submitted",
    render: (offer) => (
      <div className="min-w-28 text-sm text-ink">
        {new Date(offer.createdAt).toLocaleDateString()}
      </div>
    ),
  },
  {
    key: "actions",
    header: "Action",
    align: "right",
    render: (offer) => <OfferRowActions offer={offer} />,
  },
];

export const OffersTable = ({ offers }: OffersTableProps) => (
  <Table columns={columns} data={offers} emptyMessage="No offers yet." />
);
