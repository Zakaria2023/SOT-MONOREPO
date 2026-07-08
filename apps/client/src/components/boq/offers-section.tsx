"use client";

import { chooseOffer } from "@/app/boq/[uuid]/actions";
import { OfferCard } from "@/components/offers/offer-card";
import { Package } from "lucide-react";
import { useState, useTransition } from "react";
import type { SelectOffers } from "services";

type OffersSectionProps = {
  boqUuid: string;
  offers: SelectOffers[];
  currency: string;
  awaiting: boolean;
};

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
    <div className="mx-auto px-6 pb-16 lg:px-8">
      <h2 className="font-heading text-2xl text-ink">Offers for you</h2>
      <p className="font-grotesk mt-1 text-sm text-[#62656B]">
        Compare what our partners quoted and pick the one that fits you best.
      </p>

      {error && (
        <p className="font-grotesk mt-4 text-sm text-red-500">{error}</p>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {offers.map((offer) => (
          <OfferCard
            key={offer.uuid}
            offer={offer}
            currency={currency}
            isSelecting={isPending && pendingUuid === offer.uuid}
            onSelect={onSelect}
          />
        ))}
      </div>

      <p className="font-grotesk mt-6 flex items-center gap-2 text-xs text-[#9CA0A8]">
        <Package size={14} />
        Payment is coming soon — selecting an offer just reserves your choice
        for now.
      </p>
    </div>
  );
};
