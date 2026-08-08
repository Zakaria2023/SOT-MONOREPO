"use client";

import {
  recordVisitAction,
  scheduleCalloutAction,
} from "@/app/(dashboard)/service/action";
import {
  SERVICE_REQUEST_KIND_LABELS,
  SERVICE_REQUEST_STATUS_LABELS,
} from "@/db/label";
import { CalendarClock, MapPin, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { ServiceRequestRow } from "services";

// The callout queue.
//
// Grouped by whether anybody has booked it, because the only question worth
// answering here is "what has nobody dealt with". A single list sorted by date
// buries an unbooked request from last week under six that are already in the diary.
//
// The `dueReason` is shown verbatim rather than recomputed. It is the sentence the
// customer was looking at when they asked, and by the time this is read the clock
// has moved — recomputing would quietly rewrite why the visit was booked.

type ServiceQueueProps = {
  requests: ServiceRequestRow[];
};

type RowProps = {
  request: ServiceRequestRow;
  onError: (message: string) => void;
};

const KIND_TONE: Record<string, string> = {
  warranty_claim: "border-sky-300 bg-sky-50 text-sky-900",
  replacement: "border-amber-300 bg-amber-50 text-amber-900",
  fault: "border-red-300 bg-red-50 text-red-800",
  inspection: "border-hairline bg-hover text-muted",
  expansion: "border-emerald-300 bg-emerald-50 text-emerald-900",
};

const Row = ({ request, onError }: RowProps) => {
  const [date, setDate] = useState("");
  const [outcome, setOutcome] = useState("");
  const [pending, startTransition] = useTransition();

  const book = (): void => {
    startTransition(async () => {
      const result = await scheduleCalloutAction(request.uuid, date);
      if (result.error) {
        onError(result.error);
      }
    });
  };

  const record = (close: boolean): void => {
    startTransition(async () => {
      const result = await recordVisitAction(request.uuid, outcome, close);
      if (result.error) {
        onError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-card border border-hairline bg-surface px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
            {request.reference}
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                KIND_TONE[request.kind]
              }`}
            >
              {request.kind === "warranty_claim" && (
                <ShieldCheck size={10} className="mr-1 inline" />
              )}
              {SERVICE_REQUEST_KIND_LABELS[request.kind]}
            </span>
          </p>

          <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
            <Link
              href={`/spaces/${request.spaceUuid}`}
              className="inline-flex items-center gap-1 hover:text-primary"
            >
              <MapPin size={10} />
              {request.spaceName}
            </Link>
            {request.ownerName && ` · ${request.ownerName}`}
            {/* Named when there is one. It is what tells the engineer which unit to
                bring a part for before they leave. */}
            {request.itemName && ` · ${request.itemName}`}
            {` · raised ${new Date(request.createdAt).toLocaleDateString()}`}
          </p>

          <p className="mt-1 text-xs text-secondary">{request.detail}</p>

          {request.dueReason && (
            <p className="mt-0.5 text-[11px] text-faint">
              Schedule said: {request.dueReason}
            </p>
          )}

          {request.outcome && (
            <p className="mt-1 text-xs text-ink">
              <span className="text-muted">Outcome: </span>
              {request.outcome}
            </p>
          )}
        </div>

        <span className="shrink-0 text-[11px] text-secondary">
          {SERVICE_REQUEST_STATUS_LABELS[request.status]}
          {request.scheduledFor && ` · ${request.scheduledFor}`}
          {request.scheduledBy && ` by ${request.scheduledBy}`}
        </span>
      </div>

      {request.status === "open" && (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-2">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-control border border-hairline bg-surface px-2.5 py-1.5 text-xs text-ink"
          />
          <button
            type="button"
            onClick={book}
            disabled={pending || date === ""}
            className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            <CalendarClock size={12} />
            Book the visit
          </button>
        </div>
      )}

      {(request.status === "scheduled" || request.status === "attended") && (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-2">
          <input
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            placeholder="What was done on the visit?"
            className="min-w-56 flex-1 rounded-control border border-hairline bg-surface px-2.5 py-1.5 text-xs text-ink"
          />
          <button
            type="button"
            onClick={() => record(true)}
            disabled={pending || outcome.trim() === ""}
            className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            <Wrench size={12} />
            Done and closed
          </button>
          {/* The second button is the one that matters: a visit that ordered a part
              is attended and NOT finished, and a queue with only "close" would lose
              the return trip. */}
          <button
            type="button"
            onClick={() => record(false)}
            disabled={pending || outcome.trim() === ""}
            className="rounded-control border border-hairline px-3 py-1.5 text-xs font-medium text-muted hover:text-ink disabled:opacity-60"
          >
            Visited, more to do
          </button>
        </div>
      )}
    </div>
  );
};

const GROUPS: { label: string; blurb: string; statuses: string[] }[] = [
  {
    label: "Nobody has booked these",
    blurb: "A request with no date is a request the customer is still waiting on.",
    statuses: ["open"],
  },
  {
    label: "In the diary",
    blurb: "Booked, not yet attended.",
    statuses: ["scheduled"],
  },
  {
    label: "Visited, still open",
    blurb: "Somebody went and it is not finished — usually a part on order.",
    statuses: ["attended"],
  },
  { label: "Closed", blurb: "", statuses: ["closed", "cancelled"] },
];

export const ServiceQueue = ({ requests }: ServiceQueueProps) => {
  const [error, setError] = useState<string>();

  if (requests.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-4 py-10 text-center text-sm text-faint">
        No visits have been asked for. A customer raises one from their own site
        page — usually because a replacement date came up.
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
        const inGroup = requests.filter((request) =>
          group.statuses.includes(request.status),
        );
        if (inGroup.length === 0) {
          return null;
        }

        return (
          <div key={group.label} className="flex flex-col gap-2">
            <div>
              <h2 className="font-heading text-lg">
                {group.label}
                <span className="ml-2 text-sm text-faint">{inGroup.length}</span>
              </h2>
              {group.blurb && (
                <p className="text-xs text-muted">{group.blurb}</p>
              )}
            </div>
            {inGroup.map((request) => (
              <Row key={request.uuid} request={request} onError={setError} />
            ))}
          </div>
        );
      })}
    </div>
  );
};
