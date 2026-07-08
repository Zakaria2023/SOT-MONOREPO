"use client";

import { submitBoq } from "@/app/(dashboard)/boqs/[uuid]/actions";
import { MapPin, Send, X } from "lucide-react";
import { useState, useTransition } from "react";
import type { MatchedPartner } from "services";
import { Button, FormError, Textarea } from "ui";

type SendToPartnersDialogProps = {
  boqUuid: string;
  closePartners: MatchedPartner[];
  otherPartners: MatchedPartner[];
};

type PartnerRowProps = {
  partner: MatchedPartner;
  selected: boolean;
  comment: string;
  disabled: boolean;
  onToggle: () => void;
  onCommentChange: (value: string) => void;
};

const PartnerRow = ({
  partner,
  selected,
  comment,
  disabled,
  onToggle,
  onCommentChange,
}: PartnerRowProps) => (
  <div
    className={`flex flex-col gap-3 rounded-card border p-4 ${
      selected ? "border-primary bg-primary-tint/30" : "border-hairline"
    }`}
  >
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          disabled={disabled}
          className="mt-1 h-4 w-4 accent-primary"
        />
        <div>
          <p className="font-medium text-ink">{partner.name}</p>
          {partner.location && (
            <p className="flex items-center gap-1 text-xs text-muted">
              <MapPin size={12} />
              {partner.location}
            </p>
          )}
        </div>
      </div>
      {partner.rank > 0 && (
        <span className="rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-semibold text-primary">
          #{partner.rank}
        </span>
      )}
    </label>

    {selected && (
      <Textarea
        value={comment}
        onChange={(event) => onCommentChange(event.target.value)}
        rows={2}
        placeholder="Add a note for this partner (optional)…"
      />
    )}
  </div>
);

export const SendToPartnersDialog = ({
  boqUuid,
  closePartners,
  otherPartners,
}: SendToPartnersDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(closePartners.map((partner) => partner.clerkUserId)),
  );
  const [comments, setComments] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const hasAnyPartners = closePartners.length + otherPartners.length > 0;
  const selectedCount = selected.size;

  const toggle = (clerkUserId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clerkUserId)) {
        next.delete(clerkUserId);
      } else {
        next.add(clerkUserId);
      }
      return next;
    });

  const setComment = (clerkUserId: string, value: string) =>
    setComments((prev) => ({ ...prev, [clerkUserId]: value }));

  const onConfirm = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await submitBoq(boqUuid, Array.from(selected), comments);
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
        disabled={!hasAnyPartners}
        className="inline-flex items-center gap-2 rounded-control bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
      >
        <Send size={16} />
        Submit &amp; send to partners
      </button>
      <p className="text-xs text-faint">
        {hasAnyPartners
          ? "Same-city partners are pre-selected. Pick any others you want to include, then send."
          : "No approved partners are available to receive this BOQ yet."}
      </p>

      {open && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
          <div className="animate-scale-in flex max-h-[85vh] w-full max-w-lg flex-col rounded-card border border-hairline bg-surface shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-4">
              <div>
                <h2 className="font-heading text-lg text-ink">
                  Send to partners
                </h2>
                <p className="mt-0.5 text-sm text-muted">
                  {selectedCount}{" "}
                  {selectedCount === 1 ? "partner" : "partners"} selected. Add a
                  note for each if you like.
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

            <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
              <section className="flex flex-col gap-3">
                <p className="text-xs font-semibold tracking-wide text-faint uppercase">
                  {closePartners.length > 0
                    ? "Closest matches (same city)"
                    : "No same-city partners for this customer"}
                </p>
                {closePartners.length === 0 ? (
                  <p className="text-sm text-muted">
                    Pick partners from the list below to send this BOQ to.
                  </p>
                ) : (
                  closePartners.map((partner) => (
                    <PartnerRow
                      key={partner.clerkUserId}
                      partner={partner}
                      selected={selected.has(partner.clerkUserId)}
                      comment={comments[partner.clerkUserId] ?? ""}
                      disabled={isPending}
                      onToggle={() => toggle(partner.clerkUserId)}
                      onCommentChange={(value) =>
                        setComment(partner.clerkUserId, value)
                      }
                    />
                  ))
                )}
              </section>

              {otherPartners.length > 0 && (
                <section className="flex flex-col gap-3">
                  <p className="text-xs font-semibold tracking-wide text-faint uppercase">
                    Other approved partners
                  </p>
                  {otherPartners.map((partner) => (
                    <PartnerRow
                      key={partner.clerkUserId}
                      partner={partner}
                      selected={selected.has(partner.clerkUserId)}
                      comment={comments[partner.clerkUserId] ?? ""}
                      disabled={isPending}
                      onToggle={() => toggle(partner.clerkUserId)}
                      onCommentChange={(value) =>
                        setComment(partner.clerkUserId, value)
                      }
                    />
                  ))}
                </section>
              )}
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
                <Button
                  type="button"
                  onClick={onConfirm}
                  disabled={isPending || selectedCount === 0}
                >
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
