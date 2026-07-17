"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { Button, Checkbox, FormError } from "ui";

type PartnerCommercialDialogProps = {
  partnerName: string;
  isIntegrated: boolean;
  isSubmitting: boolean;
  error?: string;
  onIntegratedChange: (value: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export const PartnerCommercialDialog = ({
  partnerName,
  isIntegrated,
  isSubmitting,
  error,
  onIntegratedChange,
  onConfirm,
  onCancel,
}: PartnerCommercialDialogProps) => (
  <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
    <div className="animate-scale-in w-full max-w-md rounded-card border border-hairline bg-surface p-6 shadow-xl">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
          <SlidersHorizontal size={20} />
        </div>
        <div className="flex flex-col gap-1 text-left">
          <h2 className="font-heading text-lg font-semibold text-ink">
            Partner integration
          </h2>
          <p className="text-sm text-muted">
            Update how &ldquo;{partnerName}&rdquo; is paid at handover.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <Checkbox
          label="Integrated partner (auto-invoiced & paid at handover)"
          checked={isIntegrated}
          onChange={(event) => onIntegratedChange(event.target.checked)}
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
          variant="primary"
          onClick={onConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  </div>
);
