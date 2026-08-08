"use client";

import {
  revokeCertificateAction,
  verifyCertificateAction,
} from "@/app/(dashboard)/training/action";
import { CERTIFICATE_STANDING_LABELS } from "@/db/label";
import { BadgeCheck, CircleAlert, Clock, ShieldOff } from "lucide-react";
import { useState, useTransition } from "react";
import type { CapabilityStanding, CertificateRow } from "services";

// A17. Certification verification.
//
// THE ONLY SCREEN THAT CAN UNLOCK A CAPABILITY. `grantCapability` refuses without a
// valid verified certificate, and `verifiedAt` can only be set here — so this button
// is the whole gate, and pressing it is a statement that somebody looked at the
// certificate.
//
// The standing shown is DERIVED, never the stored column. A certificate that lapsed
// last month still reads `verified` in the database because nothing runs at midnight,
// and rendering that column would show an expired certificate as live. Every row here
// is computed from today's date in the service.
//
// The lapsed-capability list REPORTS and does not revoke. Taking a capability away
// narrows what a partner may sell and cuts their discount in the same moment; doing
// that from a sweep with nobody's name on it is how a partner discovers their pricing
// changed and cannot find out why.

type CertificationBoardProps = {
  certificates: CertificateRow[];
  lapsed: {
    partnerUuid: string;
    partnerName: string | null;
    lapsed: CapabilityStanding[];
  }[];
};

const TONE: Record<string, string> = {
  valid: "border-emerald-300 bg-emerald-50 text-emerald-900",
  unverified: "border-amber-300 bg-amber-50 text-amber-900",
  expired: "border-red-300 bg-red-50 text-red-800",
  revoked: "border-hairline bg-hover text-muted",
};

export const CertificationBoard = ({
  certificates,
  lapsed,
}: CertificationBoardProps) => {
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

  const withdraw = (uuid: string): void => {
    const reason = window.prompt("Why is this being withdrawn?");
    if (reason === null || reason.trim() === "") {
      return;
    }
    run(() => revokeCertificateAction(uuid, reason));
  };

  const waiting = certificates.filter(
    (row) => row.state.standing === "unverified",
  );
  const lapsingSoon = certificates.filter((row) => row.state.lapsingSoon);
  const rest = certificates.filter(
    (row) => row.state.standing !== "unverified" && !row.state.lapsingSoon,
  );

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Capabilities held on certificates that have gone. First, because it is the
          only thing on this page that is actively wrong right now. */}
      {lapsed.length > 0 && (
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="font-heading flex items-center gap-2 text-lg">
              <CircleAlert size={17} className="text-red-500" />
              Capabilities without a valid certificate
              <span className="text-sm text-faint">{lapsed.length}</span>
            </h2>
            <p className="text-xs text-muted">
              These partners hold a capability whose certificate has lapsed or was
              never verified. Nothing has been taken away automatically — revoke it
              from the partner&apos;s own screen, with a reason, so they can be told
              why their pricing changed.
            </p>
          </div>
          {lapsed.map((entry) => (
            <div
              key={entry.partnerUuid}
              className="rounded-card border border-red-200 bg-red-50 px-4 py-3"
            >
              <p className="text-sm font-medium text-ink">
                {entry.partnerName ?? "A partner"}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {entry.lapsed.map((standing) => (
                  <li key={standing.capability} className="text-[11px] text-red-800">
                    {standing.capability.replace(/_/g, " ")} — {standing.reason}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div>
          <h2 className="font-heading flex items-center gap-2 text-lg">
            <Clock size={17} className="text-amber-500" />
            Waiting to be checked
            <span className="text-sm text-faint">{waiting.length}</span>
          </h2>
          <p className="text-xs text-muted">
            Until one of these is verified it unlocks nothing — a certificate nobody
            has looked at is a claim, not evidence.
          </p>
        </div>
        {waiting.length === 0 ? (
          <p className="rounded-card border border-dashed border-hairline px-4 py-6 text-center text-sm text-faint">
            Nothing waiting.
          </p>
        ) : (
          waiting.map((row) => (
            <div
              key={row.uuid}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {row.partnerName ?? "A partner"} · {row.capability.replace(/_/g, " ")}
                </p>
                <p className="text-[11px] text-muted">
                  {row.reference} · issued {row.issuedOn} by {row.issuedByName ?? "SOT"}
                  {row.externalReference && ` · their ref ${row.externalReference}`}
                  {row.expiresOn ? ` · expires ${row.expiresOn}` : " · does not expire"}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => run(() => verifyCertificateAction(row.uuid))}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                >
                  <BadgeCheck size={12} />
                  I have checked this
                </button>
                <button
                  type="button"
                  onClick={() => withdraw(row.uuid)}
                  disabled={pending}
                  className="rounded-control border border-hairline px-2.5 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-60"
                >
                  Withdraw
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {lapsingSoon.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-lg">
            Lapsing soon
            <span className="ml-2 text-sm text-faint">{lapsingSoon.length}</span>
          </h2>
          {lapsingSoon.map((row) => (
            <div
              key={row.uuid}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-3"
            >
              <p className="text-sm text-ink">
                {row.partnerName ?? "A partner"} · {row.capability.replace(/_/g, " ")}
              </p>
              <span className="text-[11px] text-amber-900">{row.state.reason}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-lg">
          Everything else
          <span className="ml-2 text-sm text-faint">{rest.length}</span>
        </h2>
        {rest.map((row) => (
          <div
            key={row.uuid}
            className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm text-ink">
                {row.partnerName ?? "A partner"} · {row.capability.replace(/_/g, " ")}
              </p>
              <p className="text-[11px] text-muted">
                {row.reference}
                {row.verifiedBy && ` · verified by ${row.verifiedBy}`}
                {row.revokedReason && ` · ${row.revokedReason}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                  TONE[row.state.standing]
                }`}
              >
                {row.state.standing === "revoked" && (
                  <ShieldOff size={10} className="mr-1 inline" />
                )}
                {/* The DERIVED standing, not the stored status — those disagree the
                    moment a certificate lapses, which is why they are separate
                    vocabularies with separate label maps. */}
                {CERTIFICATE_STANDING_LABELS[row.state.standing]}
              </span>
              {row.state.standing !== "revoked" && (
                <button
                  type="button"
                  onClick={() => withdraw(row.uuid)}
                  disabled={pending}
                  className="rounded-control border border-hairline px-2.5 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-60"
                >
                  Withdraw
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
