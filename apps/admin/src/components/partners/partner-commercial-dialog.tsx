"use client";

import { PARTNER_BADGE_LABELS } from "@/db/label";
import { partnerBadges, type PartnerBadge } from "@/db/enum";
import { SlidersHorizontal, X } from "lucide-react";
import { Button, Checkbox, Dropdown, FormError } from "ui";

type PartnerCommercialDialogProps = {
  partnerName: string;
  badge: PartnerBadge;
  isIntegrated: boolean;
  isSubmitting: boolean;
  error?: string;
  onBadgeChange: (value: PartnerBadge) => void;
  onIntegratedChange: (value: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

const badgeOptions = partnerBadges.map((badge) => ({
  value: badge,
  label: PARTNER_BADGE_LABELS[badge],
}));

export const PartnerCommercialDialog = ({
  partnerName,
  badge,
  isIntegrated,
  isSubmitting,
  error,
  onBadgeChange,
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
            Commercial profile
          </h2>
          <p className="text-sm text-muted">
            Update the badge and integration for &ldquo;{partnerName}&rdquo;.
          </p>
        </div>
      </div>

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
          {isSubmitting ? "Saving..." : "Save profile"}
        </Button>
      </div>
    </div>
  </div>
);
