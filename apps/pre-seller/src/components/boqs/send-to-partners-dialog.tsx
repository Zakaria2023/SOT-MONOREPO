"use client";

import { submitBoq } from "@/app/(dashboard)/boqs/[uuid]/actions";
import { MapPin, Send, X } from "lucide-react";
import { useState, useTransition } from "react";
import type { MatchedPartner } from "services";
import { Button, FormError, Textarea } from "ui";

type SendToPartnersDialogProps = {
  boqUuid: string;
  partners: MatchedPartner[];
};

export const SendToPartnersDialog = ({
  boqUuid,
  partners,
}: SendToPartnersDialogProps) => {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const hasPartners = partners.length > 0;

  const setComment = (clerkUserId: string, value: string) =>
    setComments((prev) => ({ ...prev, [clerkUserId]: value }));

  const onConfirm = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await submitBoq(boqUuid, comments);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!hasPartners}
        className="inline-flex items-center gap-2 rounded-control bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
      >
        <Send size={16} />
        Submit &amp; send to partners
      </button>
      <p className="text-xs text-faint">
        {hasPartners
          ? "Review the three closest partners and add a note for each before sending."
          : "No approved partners are available to receive this BOQ yet."}
      </p>

      {open && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
          <div className="animate-scale-in flex max-h-[85vh] w-full max-w-lg flex-col rounded-card border border-hairline bg-surface shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-4">
              <div>
                <h2 className="font-heading text-lg text-ink">
                  Send to {partners.length}{" "}
                  {partners.length === 1 ? "partner" : "partners"}
                </h2>
                <p className="mt-0.5 text-sm text-muted">
                  Closest to the customer first. Add a note for each partner.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-secondary transition-colors hover:bg-hover"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
              {partners.map((partner) => (
                <div
                  key={partner.clerkUserId}
                  className="flex flex-col gap-3 rounded-card border border-hairline p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{partner.name}</p>
                      {partner.location && (
                        <p className="flex items-center gap-1 text-xs text-muted">
                          <MapPin size={12} />
                          {partner.location}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-semibold text-primary">
                      #{partner.rank}
                    </span>
                  </div>

                  <Textarea
                    value={comments[partner.clerkUserId] ?? ""}
                    onChange={(event) =>
                      setComment(partner.clerkUserId, event.target.value)
                    }
                    rows={3}
                    placeholder="Add a note for this partner (optional)…"
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-hairline px-6 py-4">
              <FormError message={error} />
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={onConfirm} disabled={isPending}>
                  <Send size={16} />
                  {isPending ? "Sending…" : "Send to partners"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
