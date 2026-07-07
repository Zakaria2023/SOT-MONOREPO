"use client";

import { Button, FormError, Input, Textarea } from "ui";
import { ShieldCheck, TriangleAlert, X } from "lucide-react";

type PartnerRequestReviewDialogProps = {
  open: boolean;
  mode: "approve" | "reject";
  partnerName: string;
  password: string;
  rejectionReason: string;
  isSubmitting: boolean;
  error?: string;
  onPasswordChange: (value: string) => void;
  onRejectionReasonChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export const PartnerRequestReviewDialog = ({
  open,
  mode,
  partnerName,
  password,
  rejectionReason,
  isSubmitting,
  error,
  onPasswordChange,
  onRejectionReasonChange,
  onConfirm,
  onCancel,
}: PartnerRequestReviewDialogProps) => {
  if (!open) return null;

  const approve = mode === "approve";

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="animate-scale-in w-full max-w-md rounded-card border border-hairline bg-surface p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              approve
                ? "bg-primary-tint text-primary"
                : "bg-danger-tint text-danger"
            }`}
          >
            {approve ? <ShieldCheck size={20} /> : <TriangleAlert size={20} />}
          </div>

          <div className="flex flex-col gap-1 text-left">
            <h2 className="font-heading text-lg font-semibold text-ink">
              {approve ? "Approve partner" : "Reject partner"}
            </h2>
            <p className="text-sm text-muted">
              {approve
                ? `Create a pre-seller account for "${partnerName}" using the password below.`
                : `Reject "${partnerName}" and save the reason in the request.`}
            </p>
          </div>
        </div>

        <div className="mt-5">
          {approve ? (
            <Input
              type="password"
              label="Password"
              placeholder="Create a password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              disabled={isSubmitting}
            />
          ) : (
            <Textarea
              label="Reject reason"
              placeholder="Explain why this request was rejected"
              rows={4}
              value={rejectionReason}
              onChange={(event) => onRejectionReasonChange(event.target.value)}
              disabled={isSubmitting}
            />
          )}
        </div>

        <FormError message={error} />

        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <X size={16} />
            Cancel
          </Button>
          <Button
            type="button"
            variant={approve ? "primary" : "danger"}
            onClick={onConfirm}
            disabled={
              isSubmitting ||
              (approve ? password.trim().length === 0 : rejectionReason.trim().length === 0)
            }
          >
            {approve ? <ShieldCheck size={16} /> : <TriangleAlert size={16} />}
            {isSubmitting
              ? approve
                ? "Approving..."
                : "Rejecting..."
              : approve
                ? "Approve"
                : "Reject"}
          </Button>
        </div>
      </div>
    </div>
  );
};
