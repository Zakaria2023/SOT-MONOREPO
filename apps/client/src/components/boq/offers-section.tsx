"use client";

import { chooseOffer, confirmOrder } from "@/app/boq/[uuid]/actions";
import { OfferCard } from "@/components/offers/offer-card";
import { ArrowRight, Package } from "lucide-react";
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

  const selected = offers.find((offer) => offer.status === "selected");

  const onSelect = (offerUuid: string) => {
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

  const onConfirm = () => {
    startTransition(async () => {
      setError(undefined);
      // On success this redirects to the order page; only errors return here.
      const result = await confirmOrder(boqUuid);
      if (result.error) {
        setError(result.error);
      }
    });
  };

  if (offers.length === 0) {
    if (!awaiting) {
      return null;
    }
    return (
      <div className="mx-auto px-6 pb-16 lg:px-12 xl:px-20">
        <div className="rounded-[18px] border border-dashed border-search-border p-8 text-center">
          <h2 className="font-heading text-xl text-ink">Offers on the way</h2>
          <p className="font-grotesk mt-1 text-sm text-muted">
            Your BOQ is with our partners. Their offers will appear here once
            approved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto px-6 pb-16 lg:px-12 xl:px-20">
      <h2 className="font-heading text-2xl text-ink">Offers for you</h2>
      <p className="font-grotesk mt-1 text-sm text-muted">
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

      {selected ? (
        <div className="mt-8 flex flex-col items-start gap-3 rounded-[18px] border border-search-border bg-hover/40 p-6">
          <p className="font-grotesk text-sm text-secondary">
            You picked{" "}
            <span className="font-semibold text-ink">this offer</span>. Confirm
            to place your order — you&apos;ll pay securely through SOT, and the
            amount is held until your system is installed and handed over.
          </p>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-solid px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-solid-hover disabled:pointer-events-none disabled:opacity-60"
          >
            {isPending ? "Confirming…" : "Confirm & order"}
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <p className="font-grotesk mt-6 flex items-center gap-2 text-xs text-faint">
          <Package size={14} />
          Pick the offer that fits you, then confirm to order and pay through
          SOT.
        </p>
      )}
    </div>
  );
};
