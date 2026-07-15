"use client";

import { TriangleAlert, X } from "lucide-react";
import { Button, FormError, Textarea } from "ui";

type OfferRejectDialogProps = {
  open: boolean;
  partnerName: string;
  rejectionReason: string;
  isSubmitting: boolean;
  error?: string;
  onRejectionReasonChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export const OfferRejectDialog = ({
  open,
  partnerName,
  rejectionReason,
  isSubmitting,
  error,
  onRejectionReasonChange,
  onConfirm,
  onCancel,
}: OfferRejectDialogProps) => {
  if (!open) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="animate-scale-in w-full max-w-md rounded-card border border-hairline bg-surface p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger">
            <TriangleAlert size={20} />
          </div>

          <div className="flex flex-col gap-1 text-left">
            <h2 className="font-heading text-lg font-semibold text-ink">
              Reject offer
            </h2>
            <p className="text-sm text-muted">
              Reject the offer from &quot;{partnerName}&quot; and save the
              reason.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <Textarea
            label="Reject reason"
            placeholder="Explain why this offer was rejected"
            rows={4}
            value={rejectionReason}
            onChange={(event) => onRejectionReasonChange(event.target.value)}
            disabled={isSubmitting}
          />
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
            variant="danger"
            onClick={onConfirm}
            disabled={isSubmitting || rejectionReason.trim().length === 0}
          >
            <TriangleAlert size={16} />
            {isSubmitting ? "Rejecting…" : "Reject"}
          </Button>
        </div>
      </div>
    </div>
  );
};
