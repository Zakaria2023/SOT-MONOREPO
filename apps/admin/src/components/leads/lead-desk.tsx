"use client";

import {
  markLeadLostAction,
  offerLeadAction,
  qualifyLeadAction,
  rejectLeadAction,
} from "@/app/(dashboard)/leads/action";
import type { PartnerCapability } from "@/db/enum";
import { LEAD_STATUS_LABELS } from "@/db/label";
import {
  CircleCheck,
  CircleHelp,
  MapPin,
  PhoneCall,
  Send,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";
import type { LeadRow } from "services";
import { Dropdown } from "ui";

// A18. The lead desk.
//
// THE FORM IS THE QUALIFICATION. There is no score anywhere on this screen and there
// will not be one: a number tells whoever is working the queue nothing about which
// question to ask next, and it invites nudging a 58 up to a 60 to clear the backlog.
// So the four facts are four fields, and the ones still missing are listed by name
// with the question to go and ask.
//
// The offer button is disabled until every fact is in — and the service refuses too,
// because a screen can be bypassed. Both, deliberately: the disabled button explains,
// and the service enforces.

type LeadDeskProps = {
  leads: LeadRow[];
};

type RowProps = {
  lead: LeadRow;
  onError: (message: string) => void;
};

const CAPABILITY_OPTIONS: { value: PartnerCapability; label: string }[] = [
  { value: "install_only", label: "Install only" },
  { value: "install_program", label: "Install and program" },
  { value: "system_integrator", label: "System integrator" },
];

const SYSTEM_OPTIONS = [
  "cctv",
  "intrusion",
  "access",
  "fire",
  "network",
  "intercom",
];

const SIZE_OPTIONS = [
  "single room",
  "villa",
  "floor",
  "building",
  "compound",
  "site",
];

const Row = ({ lead, onError }: RowProps) => {
  const [systems, setSystems] = useState<string[]>(lead.systems ?? []);
  const [sizeBand, setSizeBand] = useState(lead.sizeBand ?? "");
  const [city, setCity] = useState(lead.city ?? "");
  const [verified, setVerified] = useState(lead.contactVerifiedAt !== null);
  const [capability, setCapability] = useState<PartnerCapability>("install_only");
  const [pending, startTransition] = useTransition();

  const run = (work: () => Promise<{ error?: string }>): void => {
    startTransition(async () => {
      const result = await work();
      if (result.error) {
        onError(result.error);
      }
    });
  };

  const save = (): void =>
    run(() =>
      qualifyLeadAction({
        leadUuid: lead.uuid,
        systems: systems.length ? systems : null,
        sizeBand: sizeBand || null,
        city: city || null,
        latitude: null,
        longitude: null,
        contactVerified: verified,
      }),
    );

  const decline = (): void => {
    const reason = window.prompt("Why is this being turned down?");
    if (reason === null || reason.trim() === "") {
      return;
    }
    run(() => rejectLeadAction(lead.uuid, reason));
  };

  const lose = (): void => {
    const reason = window.prompt("Why was it lost?");
    if (reason === null) {
      return;
    }
    run(() => markLeadLostAction(lead.uuid, reason));
  };

  const settled =
    lead.status === "rejected" ||
    lead.status === "converted" ||
    lead.status === "lost";

  return (
    <div className="flex flex-col gap-3 rounded-card border border-hairline bg-surface px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            {lead.reference} · {lead.contactName}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
            {lead.source && `via ${lead.source}`}
            {lead.contactPhone && ` · ${lead.contactPhone}`}
            {lead.contactEmail && ` · ${lead.contactEmail}`}
            {lead.currentPartnerName && ` · with ${lead.currentPartnerName}`}
            {lead.offerCount > 0 && ` · offered ${lead.offerCount}×`}
          </p>
          {lead.enquiry && (
            <p className="mt-1 text-xs text-secondary">{lead.enquiry}</p>
          )}
          {lead.rejectedReason && (
            <p className="mt-1 text-xs text-muted">
              Turned down: {lead.rejectedReason}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[11px] text-secondary">
            {LEAD_STATUS_LABELS[lead.status]}
          </span>
          {/* Named gaps, never a score. Each one is the question to go and ask. */}
          {lead.qualification.qualified ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
              <CircleCheck size={11} />
              Qualified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
              <CircleHelp size={11} />
              {lead.qualification.summary}
            </span>
          )}
        </div>
      </div>

      {!settled && (
        <>
          {!lead.qualification.qualified && (
            <ul className="flex flex-col gap-0.5 rounded-control border border-amber-200 bg-amber-50 px-3 py-2">
              {lead.qualification.missing.map((gap) => (
                <li key={gap.field} className="text-[11px] text-amber-900">
                  {gap.ask}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-end gap-2 border-t border-hairline pt-3">
            <div className="flex min-w-44 flex-col gap-1 text-xs text-muted">
              Systems
              <Dropdown
                multiple
                value={systems}
                onChange={setSystems}
                placeholder="Which systems"
                options={SYSTEM_OPTIONS.map((system) => ({
                  value: system,
                  label: system,
                }))}
              />
            </div>

            <div className="flex min-w-36 flex-col gap-1 text-xs text-muted">
              Rough size
              <Dropdown
                value={sizeBand}
                onChange={setSizeBand}
                placeholder="A band is enough"
                options={SIZE_OPTIONS.map((size) => ({
                  value: size,
                  label: size,
                }))}
              />
            </div>

            <label className="flex flex-col gap-1 text-xs text-muted">
              City
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="w-40 rounded-control border border-hairline bg-surface px-2.5 py-1.5 text-xs text-ink"
              />
            </label>

            <label className="flex items-center gap-2 pb-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={verified}
                onChange={(event) => setVerified(event.target.checked)}
              />
              <PhoneCall size={12} />
              {/* The fact only a human can supply, and the one that separates a real
                  enquiry from a form filled in by a bot. */}
              I have spoken to them
            </label>

            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-control border border-hairline px-3 py-2 text-xs font-medium text-ink hover:border-primary disabled:opacity-60"
            >
              Save
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-44 flex-col gap-1 text-xs text-muted">
              Needs a partner who can
              <Dropdown
                value={capability}
                onChange={(value) => setCapability(value as PartnerCapability)}
                options={CAPABILITY_OPTIONS}
              />
            </div>
            <button
              type="button"
              onClick={() => run(() => offerLeadAction(lead.uuid, capability))}
              disabled={pending || !lead.qualification.qualified}
              className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
            >
              <Send size={12} />
              {lead.offerCount > 0 ? "Offer to the next partner" : "Offer it"}
            </button>
            {/* Says WHY it is disabled. A dead button with no explanation teaches
                somebody the screen is broken. */}
            {!lead.qualification.qualified && (
              <span className="pb-2 text-[11px] text-muted">
                Qualify it first — partners stop trusting the feed after a handful
                of tyre-kickers.
              </span>
            )}
            <button
              type="button"
              onClick={decline}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-control border border-hairline px-2.5 py-2 text-xs text-muted hover:text-ink disabled:opacity-60"
            >
              <X size={12} />
              Turn down
            </button>
            {lead.status === "accepted" && (
              <button
                type="button"
                onClick={lose}
                disabled={pending}
                className="rounded-control border border-hairline px-2.5 py-2 text-xs text-muted hover:text-ink disabled:opacity-60"
              >
                Mark lost
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const GROUPS: { label: string; blurb: string; statuses: string[] }[] = [
  {
    label: "Not yet qualified",
    blurb:
      "Nobody may be offered these. Qualification is what makes the channel worth having.",
    statuses: ["new"],
  },
  {
    label: "Qualified, waiting to be offered",
    blurb: "Ready to go out.",
    statuses: ["qualified"],
  },
  {
    label: "With a partner",
    blurb: "Offered or taken on. An offer cascades on its own when its time runs out.",
    statuses: ["offered", "accepted"],
  },
  { label: "Closed", blurb: "", statuses: ["converted", "lost", "rejected"] },
];

export const LeadDesk = ({ leads }: LeadDeskProps) => {
  const [error, setError] = useState<string>();

  if (leads.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-4 py-10 text-center text-sm text-faint">
        No leads yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {GROUPS.map((group) => {
        const inGroup = leads.filter((lead) =>
          group.statuses.includes(lead.status),
        );
        if (inGroup.length === 0) {
          return null;
        }
        return (
          <div key={group.label} className="flex flex-col gap-2">
            <div>
              <h2 className="font-heading flex items-center gap-2 text-lg">
                <MapPin size={16} className="text-primary" />
                {group.label}
                <span className="text-sm text-faint">{inGroup.length}</span>
              </h2>
              {group.blurb && <p className="text-xs text-muted">{group.blurb}</p>}
            </div>
            {inGroup.map((lead) => (
              <Row key={lead.uuid} lead={lead} onError={setError} />
            ))}
          </div>
        );
      })}
    </div>
  );
};
