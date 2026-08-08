"use client";

import { acceptLeadAction, declineLeadAction } from "@/app/(dashboard)/leads/actions";
import { LEAD_OFFER_STATUS_LABELS } from "@/db/label";
import {
  CircleCheck,
  Clock,
  Lock,
  MapPin,
  PhoneCall,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";
import type { LeadOfferRow } from "services";

// P16. A partner's lead feed.
//
// THE CONTACT DETAILS ARE HIDDEN UNTIL THEY ACCEPT, and the screen says so rather
// than just omitting them. A partner deciding whether to take a job needs the system,
// the size and the city; they do not need the customer's phone number yet. Handing it
// over at the offer stage means a lead can be worked without ever being accepted —
// which loses SOT any record of who did what, and loses the customer anybody
// accountable.
//
// Saying it out loud matters: a blank where a phone number should be reads as a bug,
// and "shown when you accept" reads as a deal.
//
// The clock is shown because the offer really does move on. It is not a nudge.

type LeadFeedProps = {
  offers: LeadOfferRow[];
};

const hoursLeft = (expiresAt: Date): number =>
  Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 3_600_000));

export const LeadFeed = ({ offers }: LeadFeedProps) => {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const run = (work: () => Promise<{ error?: string }>): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await work();
      if (result.error) {
        setError(result.error);
      }
    });
  };

  const pass = (offerUuid: string): void => {
    const reason = window.prompt("Anything we should know? (optional)") ?? "";
    run(() => declineLeadAction(offerUuid, reason));
  };

  if (offers.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-4 py-12 text-center text-sm text-faint">
        No leads yet. We only send you ones that have been qualified — the system,
        the size, the location and a real person on the other end.
      </p>
    );
  }

  const open = offers.filter((offer) => offer.status === "offered");
  const rest = offers.filter((offer) => offer.status !== "offered");

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {open.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg">Waiting on you</h2>
          {open.map((offer) => (
            <div
              key={offer.uuid}
              className="flex flex-col gap-3 rounded-card border border-primary/40 bg-surface px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {(offer.systems ?? []).join(", ") || "A system"}
                    {offer.sizeBand && ` · ${offer.sizeBand}`}
                  </p>
                  <p className="flex items-center gap-1.5 text-[11px] text-muted">
                    <MapPin size={11} />
                    {offer.city ?? "location to be confirmed"}
                    {offer.cascadeRound > 1 &&
                      ` · passed on by ${offer.cascadeRound - 1} before you`}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-amber-700">
                  <Clock size={11} />
                  {hoursLeft(offer.expiresAt)} hours left
                </span>
              </div>

              {/* Said, not omitted. A blank reads as a bug; this reads as a deal. */}
              <p className="flex items-center gap-1.5 rounded-control border border-hairline bg-hover px-3 py-2 text-xs text-muted">
                <Lock size={12} className="shrink-0" />
                The customer&apos;s name and number are shown once you accept.
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => run(() => acceptLeadAction(offer.uuid))}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                >
                  <CircleCheck size={13} />
                  Take it on
                </button>
                <button
                  type="button"
                  onClick={() => pass(offer.uuid)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-control border border-hairline px-3 py-2 text-xs font-medium text-muted hover:text-ink disabled:opacity-60"
                >
                  <X size={12} />
                  Pass
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg">Everything else</h2>
        {rest.map((offer) => (
          <div
            key={offer.uuid}
            className="flex flex-col gap-2 rounded-card border border-hairline bg-surface px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink">
                {(offer.systems ?? []).join(", ") || "A system"}
                {offer.city && ` · ${offer.city}`}
              </p>
              <span className="shrink-0 text-[11px] text-secondary">
                {LEAD_OFFER_STATUS_LABELS[offer.status]}
              </span>
            </div>

            {/* Released only on acceptance — the service nulls them otherwise, so
                there is nothing here to leak. */}
            {offer.status === "accepted" && (
              <div className="flex flex-col gap-1 rounded-control border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-900">
                  <PhoneCall size={12} />
                  {offer.contactName}
                  {offer.contactPhone && ` · ${offer.contactPhone}`}
                  {offer.contactEmail && ` · ${offer.contactEmail}`}
                </p>
                {offer.enquiry && (
                  <p className="text-xs text-emerald-800">{offer.enquiry}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
};
