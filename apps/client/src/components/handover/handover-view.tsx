"use client";

import { confirmHandover, reportHandoverIssue } from "@/app/boq/[uuid]/actions";
import {
  HANDOVER_CREDENTIAL_TYPE_LABELS,
  HANDOVER_STATUS_LABELS,
} from "@/db/label";
import { CheckCircle2, KeyRound, MapPin, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import type {
  SelectHandoverAssets,
  SelectHandoverCredentials,
  SelectHandoverPacks,
} from "services";

type HandoverViewProps = {
  boqUuid: string;
  pack: SelectHandoverPacks;
  assets: SelectHandoverAssets[];
  credentials: SelectHandoverCredentials[];
};

export const HandoverView = ({
  boqUuid,
  pack,
  assets,
  credentials,
}: HandoverViewProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);

  const awaitingCustomer = pack.status === "submitted";
  const done = pack.status === "verified";

  const onConfirm = () => {
    startTransition(async () => {
      setError(undefined);
      const result = await confirmHandover(boqUuid);
      if (result.error) {
        setError(result.error);
      }
    });
  };

  const onReport = () => {
    startTransition(async () => {
      setError(undefined);
      const result = await reportHandoverIssue(boqUuid, reason);
      if (result.error) {
        setError(result.error);
      } else setShowDispute(false);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-primary" />
        <span className="text-sm font-semibold text-ink">
          {HANDOVER_STATUS_LABELS[pack.status]}
        </span>
      </div>

      <section>
        <h2 className="font-heading text-lg text-ink">Your devices</h2>
        <div className="mt-3 overflow-hidden rounded-[18px] border border-search-border">
          {assets.map((asset, index) => (
            <div
              key={asset.uuid}
              className={`p-4 ${index > 0 ? "border-t border-hairline-soft" : ""}`}
            >
              <p className="font-medium text-ink">{asset.name}</p>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {asset.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} />
                    {asset.location}
                  </span>
                )}
                {asset.localIp && <span>IP {asset.localIp}</span>}
                {asset.port && <span>Port {asset.port}</span>}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg text-ink">
          Your access — yours to keep
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {credentials.map((cred) => (
            <div
              key={cred.uuid}
              className="rounded-[14px] border border-search-border p-4"
            >
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <KeyRound size={14} className="text-primary" />
                {cred.label}
              </p>
              <p className="mt-0.5 text-xs text-faint">
                {HANDOVER_CREDENTIAL_TYPE_LABELS[cred.type]}
              </p>
              <div className="mt-2 grid gap-1 text-xs text-muted">
                {cred.target && <span>Where: {cred.target}</span>}
                {cred.username && <span>User: {cred.username}</span>}
                {cred.secret && <span>Password: {cred.secret}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {pack.trainingNotes && (
        <section>
          <h2 className="font-heading text-lg text-ink">Training notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">
            {pack.trainingNotes}
          </p>
        </section>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {awaitingCustomer && (
        <div className="flex flex-col gap-3 rounded-[18px] border border-search-border bg-hover/40 p-6">
          <p className="text-sm text-secondary">
            Test each login and device above. Confirming tells us you have full,
            working control of your system.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-solid px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-solid-hover disabled:pointer-events-none disabled:opacity-60"
            >
              <CheckCircle2 size={16} />
              {isPending ? "Confirming…" : "My access works — confirm"}
            </button>
            <button
              type="button"
              onClick={() => setShowDispute((prev) => !prev)}
              className="inline-flex items-center rounded-xl border border-search-border px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-hover"
            >
              Something&apos;s wrong
            </button>
          </div>

          {showDispute && (
            <div className="mt-2 flex flex-col gap-2">
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="What isn't working? A login fails, a device is missing…"
                className="w-full rounded-[14px] border border-search-border bg-surface p-3 text-sm text-ink outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={onReport}
                disabled={isPending || !reason.trim()}
                className="inline-flex w-fit items-center rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:pointer-events-none disabled:opacity-60"
              >
                {isPending ? "Sending…" : "Report issue"}
              </button>
            </div>
          )}
        </div>
      )}

      {done && (
        <p className="flex items-center gap-2 rounded-[18px] bg-success-tint p-4 text-sm text-success">
          <CheckCircle2 size={16} />
          Verified — this system is yours. These records stay in your account
          permanently.
        </p>
      )}
    </div>
  );
};
