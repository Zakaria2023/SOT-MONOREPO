"use client";

import { formatMoney, offerTotal } from "utils";
import { cn } from "@/lib/utils";
import { Check, CreditCard } from "lucide-react";
import type { SelectOffers } from "services";

type OfferCardProps = {
  offer: SelectOffers;
  currency: string;
  isSelecting: boolean;
  onSelect: (offerUuid: string) => void;
  boqReference?: string | null;
};

const SCOPE_LABELS: Record<string, string> = {
  installation: "Installation only",
  "install-program": "Install + program",
};

export const OfferCard = ({
  offer,
  currency,
  isSelecting,
  onSelect,
  boqReference,
}: OfferCardProps) => {
  const selected = offer.status === "selected";

  return (
    <div
      className={cn(
        "flex flex-col rounded-[18px] border bg-surface p-6 transition-colors",
        selected ? "border-primary ring-4 ring-primary/15" : "border-hairline",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-lg font-semibold text-ink">
            {offer.partnerName ?? "Partner"}
          </p>
          <p className="font-grotesk text-xs text-faint">
            {SCOPE_LABELS[offer.serviceScope] ?? offer.serviceScope}
          </p>
        </div>
        {selected && (
          <span className="font-grotesk flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <Check size={12} />
            Selected
          </span>
        )}
      </div>

      {boqReference && (
        <p className="font-grotesk mt-2 text-xs text-faint">
          For {boqReference}
        </p>
      )}

      <div className="font-grotesk mt-5 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Product</span>
          <span className="text-ink">
            {formatMoney(Number(offer.productPrice), currency)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Installation</span>
          <span className="text-ink">
            {formatMoney(Number(offer.installPrice), currency)}
          </span>
        </div>
        {offer.programmingPrice && (
          <div className="flex justify-between">
            <span className="text-muted">Programming</span>
            <span className="text-ink">
              {formatMoney(Number(offer.programmingPrice), currency)}
            </span>
          </div>
        )}
        <div className="mt-1 flex items-center justify-between border-t border-hairline pt-3">
          <span className="font-medium text-ink">Total</span>
          <span className="font-heading text-2xl tabular-nums text-ink">
            {formatMoney(offerTotal(offer), currency)}
          </span>
        </div>
      </div>

      {offer.description && (
        <p className="font-grotesk mt-4 whitespace-pre-wrap text-sm text-muted">
          {offer.description}
        </p>
      )}

      <div className="mt-6">
        {selected ? (
          <button
            type="button"
            disabled
            className="font-grotesk inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-solid py-3 text-sm font-semibold text-white opacity-60"
          >
            <CreditCard size={16} />
            Proceed to payment
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(offer.uuid)}
            disabled={isSelecting}
            className="font-grotesk inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-solid hover:text-white disabled:pointer-events-none disabled:opacity-60"
          >
            {isSelecting ? "Selecting…" : "Select this offer"}
          </button>
        )}
      </div>
    </div>
  );
};
