"use client";

import type { PartnerRequestListItem } from "@/app/(dashboard)/partners/action";
import { PARTNER_TYPE_LABELS } from "@/db/label";
import { documentDownloadUrl } from "@/lib/documents";
import { FileText, X } from "lucide-react";
import Link from "next/link";
import { Button } from "ui";

type PartnerRequestDetailsDialogProps = {
  request: PartnerRequestListItem;
  onClose: () => void;
};

type DetailField = {
  label: string;
  value: string;
};

export const PartnerRequestDetailsDialog = ({
  request,
  onClose,
}: PartnerRequestDetailsDialogProps) => {
  const fields: DetailField[] = [
    { label: "Type", value: PARTNER_TYPE_LABELS[request.type] },
    { label: "Full name", value: request.fullName },
    { label: "Email", value: request.email },
    { label: "Contact number", value: request.contactNumber },
    { label: "Location", value: request.location },
  ];

  if (request.type === "individual") {
    if (request.firstName) {
      fields.push({ label: "First name", value: request.firstName });
    }
    if (request.middleName) {
      fields.push({ label: "Middle name", value: request.middleName });
    }
    if (request.lastName) {
      fields.push({ label: "Last name", value: request.lastName });
    }
  } else {
    if (request.companyName) {
      fields.push({
        label: request.type === "government" ? "Entity name" : "Company name",
        value: request.companyName,
      });
    }
    if (request.representativeName) {
      fields.push({
        label: "Representative",
        value: request.representativeName,
      });
    }
    if (request.unifiedNumber) {
      fields.push({ label: "Unified number", value: request.unifiedNumber });
    }
    if (request.crNumber) {
      fields.push({ label: "CR number", value: request.crNumber });
    }
    if (request.vatNumber) {
      fields.push({ label: "VAT number", value: request.vatNumber });
    }
    if (request.nationalAddress) {
      fields.push({
        label: "National address",
        value: request.nationalAddress,
      });
    }
  }

  if (request.rejectionReason) {
    fields.push({ label: "Rejection reason", value: request.rejectionReason });
  }
  if (request.reviewedByName) {
    fields.push({ label: "Reviewed by", value: request.reviewedByName });
  }

  const certificates = [
    { label: "CR certificate", documentId: request.crCertificate },
    { label: "VAT certificate", documentId: request.vatCertificate },
  ].filter(
    (certificate): certificate is { label: string; documentId: string } =>
      Boolean(certificate.documentId),
  );

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="animate-scale-in w-full max-w-lg rounded-card border border-hairline bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-semibold text-ink">
              Partner request details
            </h2>
            <p className="text-sm text-muted">
              Submitted {new Date(request.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Button type="button" variant="icon" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        <dl className="mt-5 grid max-h-96 grid-cols-1 gap-x-6 gap-y-4 overflow-y-auto sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label}>
              <dt className="text-xs font-semibold tracking-wide text-faint uppercase">
                {field.label}
              </dt>
              <dd className="mt-0.5 whitespace-pre-wrap wrap-break-word text-sm text-ink">
                {field.value}
              </dd>
            </div>
          ))}

          {certificates.map((certificate) => (
            <div key={certificate.label}>
              <dt className="text-xs font-semibold tracking-wide text-faint uppercase">
                {certificate.label}
              </dt>
              <dd className="mt-0.5 text-sm">
                <Link
                  href={documentDownloadUrl(certificate.documentId)}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <FileText size={14} />
                  View document
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
};
