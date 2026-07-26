"use client";

import { chooseOffer } from "@/app/boq/[uuid]/actions";
import { OfferCard } from "@/components/offers/offer-card";
import { Package } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { OfferForUser } from "services";

type OffersListProps = {
  offers: OfferForUser[];
};

export const OffersList = ({ offers }: OffersListProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const [pendingUuid, setPendingUuid] = useState<string | null>(null);

  const onSelect = (boqUuid: string, offerUuid: string) => {
    setPendingUuid(offerUuid);
    startTransition(async () => {
      setError(undefined);
      const result = await chooseOffer(boqUuid, offerUuid);
      if (result.error) {
        setError(result.error);
      }
      setPendingUuid(null);
    });
  };

  if (offers.length === 0) {
    return (
      <div className="mt-8 rounded-[18px] border border-dashed border-search-border p-10 text-center">
        <h2 className="font-heading text-xl text-ink">No offers yet</h2>
        <p className="font-grotesk mt-1 text-sm text-muted">
          Once our partners quote your BOQs, their approved offers will show up
          here.
        </p>
        <Link
          href="/"
          className="font-grotesk mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
        >
          Browse hardware
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {error && (
        <p className="font-grotesk mb-4 text-sm text-red-500">{error}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {offers.map((offer) => (
          <OfferCard
            key={offer.uuid}
            offer={offer}
            currency={offer.currency ?? "SAR"}
            boqReference={offer.boqReference}
            isSelecting={isPending && pendingUuid === offer.uuid}
            onSelect={(offerUuid) => onSelect(offer.boqUuid, offerUuid)}
          />
        ))}
      </div>

      <p className="font-grotesk mt-6 flex items-center gap-2 text-xs text-faint">
        <Package size={14} />
        Payment is coming soon — selecting an offer just reserves your choice for
        now.
      </p>
    </div>
  );
};
