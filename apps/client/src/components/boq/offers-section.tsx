"use client";

import { chooseOffer } from "@/app/boq/[uuid]/actions";
import { formatMoney } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { Check, CreditCard, Package } from "lucide-react";
import { useState, useTransition } from "react";
import type { SelectOffers } from "services";

type OffersSectionProps = {
  boqUuid: string;
  offers: SelectOffers[];
  currency: string;
  awaiting: boolean;
};

const SCOPE_LABELS: Record<string, string> = {
  installation: "Installation only",
  "install-program": "Install + program",
};

const offerTotal = (offer: SelectOffers): number =>
  Number(offer.productPrice) +
  Number(offer.installPrice) +
  Number(offer.programmingPrice ?? 0);

export const OffersSection = ({
  boqUuid,
  offers,
  currency,
  awaiting,
}: OffersSectionProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const [pendingUuid, setPendingUuid] = useState<string | null>(null);

  const onSelect = (offerUuid: string) => {
    setPendingUuid(offerUuid);
    startTransition(async () => {
      setError(undefined);
      const result = await chooseOffer(boqUuid, offerUuid);
      if (result.error) setError(result.error);
      setPendingUuid(null);
    });
  };

  if (offers.length === 0) {
    if (!awaiting) return null;
    return (
      <div className="mx-auto max-w-6xl px-6 pb-16 lg:px-8">
        <div className="rounded-[18px] border border-dashed border-[#E3E4E9] p-8 text-center">
          <h2 className="font-heading text-xl text-ink">Offers on the way</h2>
          <p className="font-grotesk mt-1 text-sm text-[#62656B]">
            Your BOQ is with our partners. Their offers will appear here once
            approved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 pb-16 lg:px-8">
      <h2 className="font-heading text-2xl text-ink">Offers for you</h2>
      <p className="font-grotesk mt-1 text-sm text-[#62656B]">
        Compare what our partners quoted and pick the one that fits you best.
      </p>

      {error && (
        <p className="font-grotesk mt-4 text-sm text-red-500">{error}</p>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {offers.map((offer) => {
          const selected = offer.status === "selected";
          return (
            <div
              key={offer.uuid}
              className={cn(
                "flex flex-col rounded-[18px] border bg-white p-6 transition-colors",
                selected
                  ? "border-primary ring-4 ring-primary/15"
                  : "border-[#ECEEF1]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-lg font-semibold text-ink">
                    {offer.partnerName ?? "Partner"}
                  </p>
                  <p className="font-grotesk text-xs text-[#8A8F98]">
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

              <div className="font-grotesk mt-5 flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#62656B]">Product</span>
                  <span className="text-ink">
                    {formatMoney(Number(offer.productPrice), currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#62656B]">Installation</span>
                  <span className="text-ink">
                    {formatMoney(Number(offer.installPrice), currency)}
                  </span>
                </div>
                {offer.programmingPrice && (
                  <div className="flex justify-between">
                    <span className="text-[#62656B]">Programming</span>
                    <span className="text-ink">
                      {formatMoney(Number(offer.programmingPrice), currency)}
                    </span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between border-t border-[#ECEEF1] pt-3">
                  <span className="font-medium text-ink">Total</span>
                  <span className="font-heading text-2xl tabular-nums text-ink">
                    {formatMoney(offerTotal(offer), currency)}
                  </span>
                </div>
              </div>

              {offer.description && (
                <p className="font-grotesk mt-4 whitespace-pre-wrap text-sm text-[#62656B]">
                  {offer.description}
                </p>
              )}

              <div className="mt-6">
                {selected ? (
                  <button
                    type="button"
                    disabled
                    className="font-grotesk inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white opacity-60"
                  >
                    <CreditCard size={16} />
                    Proceed to payment (coming soon)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(offer.uuid)}
                    disabled={isPending}
                    className="font-grotesk inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:pointer-events-none disabled:opacity-60"
                  >
                    {isPending && pendingUuid === offer.uuid
                      ? "Selecting…"
                      : "Select this offer"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="font-grotesk mt-6 flex items-center gap-2 text-xs text-[#9CA0A8]">
        <Package size={14} />
        Payment is coming soon — selecting an offer just reserves your choice for
        now.
      </p>
    </div>
  );
};
