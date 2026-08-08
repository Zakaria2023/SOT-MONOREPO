"use client";

import {
  getCapabilityHistoryAction,
  getCapabilityStateAction,
  grantCapabilityAction,
  revokeCapabilityAction,
} from "@/app/(dashboard)/partners/action";
import { partnerCapabilities, type PartnerCapability } from "@/db/enum";
import type { CapabilityState, SelectPartnerCapabilityLog } from "services";
import { Check, Minus, Plus, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Button, Input } from "ui";
import { PARTNER_CAPABILITY_LABELS } from "validators";

// ---------------------------------------------------------------------------
// WHAT THIS PARTNER IS APPROVED TO DO.
//
// A capability is the badge — install only, install and program, pre-sell,
// post-sell, hold stock, system integrator. It was chosen when they applied and
// then frozen: a partner who later earned the right to program had no way to be
// given it short of editing the database by hand.
//
// Every row shows what it is worth, because the discount is the SUM of the
// percentages for the capabilities held. Granting one is a pricing decision as
// much as a permission, and it should not be possible to make it without seeing
// the number move.
// ---------------------------------------------------------------------------

type PartnerCapabilitiesDialogProps = {
  partnerUuid: string;
  partnerName: string;
  onClose: () => void;
};

export const PartnerCapabilitiesDialog = ({
  partnerUuid,
  partnerName,
  onClose,
}: PartnerCapabilitiesDialogProps) => {
  const [state, setState] = useState<CapabilityState | null>();
  const [history, setHistory] = useState<SelectPartnerCapabilityLog[]>([]);
  const [reasonFor, setReasonFor] = useState<PartnerCapability | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const load = (): void => {
    getCapabilityStateAction(partnerUuid).then(setState);
    getCapabilityHistoryAction(partnerUuid).then(setHistory);
  };

  useEffect(load, [partnerUuid]);

  const grant = (capability: PartnerCapability): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await grantCapabilityAction(partnerUuid, capability, null);
      if (result.error) {
        setError(result.error);
        return;
      }
      load();
    });
  };

  const revoke = (capability: PartnerCapability): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await revokeCapabilityAction(
        partnerUuid,
        capability,
        reason,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setReasonFor(null);
      setReason("");
      load();
    });
  };

  const held = new Set(state?.held ?? []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-card border border-hairline bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-lg text-ink">
              What {partnerName} may do
            </h2>
            <p className="text-xs text-muted">
              Their discount is the total of what they hold — currently{" "}
              <span className="font-medium text-ink">
                {state?.discountPercent ?? 0}%
              </span>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-control p-1.5 text-faint hover:bg-hover hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <p className="rounded-control border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-400">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          {partnerCapabilities.map((capability) => {
            const has = held.has(capability);
            const worth = state?.discounts[capability] ?? 0;
            return (
              <div
                key={capability}
                className="flex flex-col gap-2 rounded-control border border-hairline bg-base px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                    {has && (
                      <Check size={13} className="shrink-0 text-emerald-400" />
                    )}
                    <span className="line-clamp-1">
                      {PARTNER_CAPABILITY_LABELS[capability]}
                    </span>
                    <span className="shrink-0 text-[11px] text-faint">
                      {worth}%
                    </span>
                  </span>

                  {has ? (
                    <button
                      type="button"
                      onClick={() =>
                        setReasonFor(
                          reasonFor === capability ? null : capability,
                        )
                      }
                      disabled={pending}
                      className="flex shrink-0 items-center gap-1 rounded-control border border-hairline px-2 py-1 text-[11px] text-secondary hover:bg-hover hover:text-ink disabled:opacity-60"
                    >
                      <Minus size={11} />
                      Take away
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => grant(capability)}
                      disabled={pending}
                      className="flex shrink-0 items-center gap-1 rounded-control border border-hairline px-2 py-1 text-[11px] text-secondary hover:bg-hover hover:text-ink disabled:opacity-60"
                    >
                      <Plus size={11} />
                      Give
                    </button>
                  )}
                </div>

                {/* Asked for at the moment of the decision, not afterwards: this
                    narrows what they may sell AND cuts their discount, and
                    somebody will have to answer for it to their face. */}
                {reasonFor === capability && (
                  <div className="flex items-end gap-2">
                    <Input
                      label="Why"
                      placeholder="Warehouse lease ended"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                    <Button
                      onClick={() => revoke(capability)}
                      disabled={pending || reason.trim() === ""}
                    >
                      Confirm
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {history.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-hairline pt-3">
            <span className="text-[11px] font-medium text-ink">
              What has changed
            </span>
            {history.map((entry) => (
              <p key={entry.uuid} className="text-[11px] text-secondary">
                {entry.action === "granted" ? "Gave" : "Took away"}{" "}
                {PARTNER_CAPABILITY_LABELS[entry.capability]} ·{" "}
                {entry.actorName ?? "—"} ·{" "}
                {new Date(entry.createdAt).toLocaleDateString()}
                {entry.reason && ` — ${entry.reason}`}
                {entry.discountPercentAfter !== null &&
                  ` (discount became ${entry.discountPercentAfter}%)`}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
