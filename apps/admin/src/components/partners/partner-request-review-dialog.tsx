"use client";

import { PARTNER_BADGE_LABELS } from "@/db/label";
import { partnerBadges, type PartnerBadge } from "@/db/enum";
import { ShieldCheck, TriangleAlert, X } from "lucide-react";
import { Button, Checkbox, Dropdown, FormError, Textarea } from "ui";

type PartnerRequestReviewDialogProps = {
  open: boolean;
  mode: "approve" | "reject";
  partnerName: string;
  email: string;
  rejectionReason: string;
  badge: PartnerBadge;
  isIntegrated: boolean;
  isSubmitting: boolean;
  error?: string;
  onRejectionReasonChange: (value: string) => void;
  onBadgeChange: (value: PartnerBadge) => void;
  onIntegratedChange: (value: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

const badgeOptions = partnerBadges.map((badge) => ({
  value: badge,
  label: PARTNER_BADGE_LABELS[badge],
}));

export const PartnerRequestReviewDialog = ({
  open,
  mode,
  partnerName,
  email,
  rejectionReason,
  badge,
  isIntegrated,
  isSubmitting,
  error,
  onRejectionReasonChange,
  onBadgeChange,
  onIntegratedChange,
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
                ? `Send a Clerk invitation to "${partnerName}" (${email}) so they can set up their partner account.`
                : `Reject "${partnerName}" and save the reason in the request.`}
            </p>
          </div>
        </div>

        {approve && (
          <div className="mt-5 flex flex-col gap-4">
            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink">
                Badge
              </span>
              <Dropdown
                options={badgeOptions}
                value={badge}
                onChange={(value) => onBadgeChange(value as PartnerBadge)}
              />
            </div>
            <Checkbox
              label="Integrated partner (auto-invoiced & paid at handover)"
              checked={isIntegrated}
              onChange={(event) => onIntegratedChange(event.target.checked)}
              disabled={isSubmitting}
            />
          </div>
        )}

        {!approve && (
          <div className="mt-5">
            <Textarea
              label="Reject reason"
              placeholder="Explain why this request was rejected"
              rows={4}
              value={rejectionReason}
              onChange={(event) => onRejectionReasonChange(event.target.value)}
              disabled={isSubmitting}
            />
          </div>
        )}

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
              isSubmitting || (!approve && rejectionReason.trim().length === 0)
            }
          >
            {approve ? <ShieldCheck size={16} /> : <TriangleAlert size={16} />}
            {isSubmitting
              ? approve
                ? "Inviting..."
                : "Rejecting..."
              : approve
                ? "Approve & invite"
                : "Reject"}
          </Button>
        </div>
      </div>
    </div>
  );
};
