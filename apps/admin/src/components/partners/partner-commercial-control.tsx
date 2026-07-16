"use client";

import { setPartnerCommercialAction } from "@/app/(dashboard)/partners/action";
import { PARTNER_BADGE_LABELS } from "@/db/label";
import { partnerBadges, type PartnerBadge } from "@/db/enum";
import { useState, useTransition } from "react";
import { Checkbox, Dropdown } from "ui";

type PartnerCommercialControlProps = {
  partnerRequestUuid: string;
  badge: PartnerBadge;
  isIntegrated: boolean;
};

const badgeOptions = partnerBadges.map((badge) => ({
  value: badge,
  label: PARTNER_BADGE_LABELS[badge],
}));

export const PartnerCommercialControl = ({
  partnerRequestUuid,
  badge: initialBadge,
  isIntegrated: initialIntegrated,
}: PartnerCommercialControlProps) => {
  const [isPending, startTransition] = useTransition();
  const [badge, setBadge] = useState<PartnerBadge>(initialBadge);
  const [isIntegrated, setIsIntegrated] = useState(initialIntegrated);
  const [error, setError] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  const onSave = () =>
    startTransition(async () => {
      setError(undefined);
      setSaved(false);
      const result = await setPartnerCommercialAction(
        partnerRequestUuid,
        badge,
        isIntegrated,
      );
      if (result.error) setError(result.error);
      else setSaved(true);
    });

  return (
    <div className="flex flex-col gap-3 rounded-control border border-hairline p-4">
      <p className="text-xs font-semibold tracking-wide text-faint uppercase">
        Commercial profile
      </p>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink">Badge</span>
        <Dropdown
          options={badgeOptions}
          value={badge}
          onChange={(value) => setBadge(value as PartnerBadge)}
        />
      </div>

      <Checkbox
        label="Integrated partner (auto-invoiced & paid at handover)"
        checked={isIntegrated}
        onChange={(event) => setIsIntegrated(event.target.checked)}
      />

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-success">Saved.</p>}

      <button
        type="button"
        onClick={onSave}
        disabled={isPending}
        className="inline-flex w-fit items-center rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
};
