"use client";

import { raiseCalloutAction } from "@/app/spaces/[uuid]/actions";
import { SERVICE_REQUEST_STATUS_LABELS } from "@/db/label";
import type { ServiceRequestKind } from "@/db/enum";
import {
  CalendarClock,
  CircleAlert,
  CircleHelp,
  ShieldCheck,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { useState, useTransition } from "react";
import type { SelectServiceRequests, ServiceItem, ServiceView } from "services";

// E10. The service door.
//
// Built out of facts that only exist because the sale, the install and the
// handover all happened in one place — which is why no checkout can copy it.
//
// THE ORDERING IS THE DESIGN. Overdue first, then due soon, then the items nobody
// has filled in, then everything that is genuinely fine. A screen sorted by name
// buries the one thing worth acting on among fifty that are not.
//
// AND "WE DO NOT KNOW" GETS ITS OWN GROUP rather than being mixed in with "fine".
// An item whose product has no rated life recorded, or whose install date nobody
// wrote down, cannot be scheduled — and quietly filing it under healthy is how a
// service contract turns out to have been covering nothing.

type ServiceDoorProps = {
  spaceUuid: string;
  view: ServiceView;
  requests: SelectServiceRequests[];
};

type ItemRowProps = {
  spaceUuid: string;
  item: ServiceItem;
  onError: (message: string) => void;
};

const TONE: Record<string, string> = {
  overdue: "border-red-200 bg-red-50 text-red-800",
  due_soon: "border-amber-200 bg-amber-50 text-amber-900",
  unknown: "border-search-border bg-hover text-muted",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

// Which kind a callout gets when it is raised from a row. Derived from the row's
// own state rather than asked, because the customer already told us by pressing
// the button next to an overdue sensor.
const kindFor = (item: ServiceItem): ServiceRequestKind => {
  if (item.next?.status === "overdue" || item.next?.status === "due_soon") {
    return "replacement";
  }
  return item.warranty.active ? "warranty_claim" : "fault";
};

const ItemRow = ({ spaceUuid, item, onError }: ItemRowProps) => {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState("");
  const [pending, startTransition] = useTransition();

  const status = item.next?.status ?? "unknown";

  const send = (): void => {
    startTransition(async () => {
      const result = await raiseCalloutAction({
        spaceUuid,
        itemUuid: item.itemUuid,
        kind: kindFor(item),
        detail,
        // Snapshotted with the request. This sentence is why it was raised.
        dueReason: item.next?.reason ?? null,
      });
      if (result.error) {
        onError(result.error);
        return;
      }
      setOpen(false);
      setDetail("");
    });
  };

  return (
    <div className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-base text-ink">
            {item.name}
            {item.location && (
              <span className="font-grotesk text-sm text-faint">
                {" · "}
                {item.location}
              </span>
            )}
          </p>

          {/* Every clock, not just the earliest. A panel rated twenty years with a
              sensor rated ten has two real answers, and showing only the nearer
              one hides that the housing is fine. */}
          <ul className="mt-1 flex flex-col gap-0.5">
            {item.schedule.map((entry) => (
              <li
                key={entry.clock}
                className="font-grotesk flex items-start gap-1.5 text-xs text-muted"
              >
                {entry.status === "overdue" ? (
                  <TriangleAlert size={11} className="mt-0.5 shrink-0 text-red-500" />
                ) : entry.status === "due_soon" ? (
                  <CalendarClock size={11} className="mt-0.5 shrink-0 text-amber-500" />
                ) : entry.status === "unknown" ? (
                  <CircleHelp size={11} className="mt-0.5 shrink-0 text-faint" />
                ) : (
                  <CalendarClock size={11} className="mt-0.5 shrink-0 text-emerald-500" />
                )}
                <span>
                  <span className="text-ink">{entry.label}</span> — {entry.reason}
                </span>
              </li>
            ))}
          </ul>

          {/* Warranty, said separately. Out of warranty and due for replacement
              are different facts, and a device is very often the first without
              being anywhere near the second. */}
          <p className="font-grotesk mt-1 flex items-center gap-1.5 text-xs">
            <ShieldCheck
              size={11}
              className={item.warranty.active ? "text-emerald-500" : "text-faint"}
            />
            <span className={item.warranty.active ? "text-emerald-800" : "text-muted"}>
              {item.warranty.reason}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`font-grotesk rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE[status]}`}
          >
            {status === "overdue"
              ? "Overdue"
              : status === "due_soon"
                ? `Due in ${item.next?.daysUntil} days`
                : status === "unknown"
                  ? "No date"
                  : "Fine"}
          </span>

          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="font-grotesk inline-flex items-center gap-1.5 rounded-full border border-search-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-primary"
            >
              <Wrench size={12} />
              Ask for a visit
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-2 rounded-control border border-search-border bg-hover p-3">
          <textarea
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            rows={2}
            placeholder="What is wrong, or what needs doing?"
            className="font-grotesk w-full rounded-control border border-search-border bg-surface px-3 py-2 text-sm text-ink"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={send}
              disabled={pending || detail.trim() === ""}
              className="font-grotesk rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              Send request
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-grotesk text-xs text-muted hover:text-ink"
            >
              Cancel
            </button>
            <span className="font-grotesk text-xs text-faint">
              {/* Said out loud, because a form that silently decides for you is a
                  form you cannot correct. */}
              Logged as: {kindFor(item) === "replacement"
                ? "replacement due"
                : kindFor(item) === "warranty_claim"
                  ? "warranty claim"
                  : "fault"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const ORDER: Record<string, number> = {
  overdue: 0,
  due_soon: 1,
  unknown: 2,
  ok: 3,
};

export const ServiceDoor = ({
  spaceUuid,
  view,
  requests,
}: ServiceDoorProps) => {
  const [error, setError] = useState<string>();

  const sorted = [...view.items].sort(
    (a, b) =>
      ORDER[a.next?.status ?? "unknown"] - ORDER[b.next?.status ?? "unknown"],
  );

  return (
    <section className="mt-8">
      <h2 className="font-heading text-lg text-ink">Service</h2>
      <p className="font-grotesk mt-0.5 text-sm text-muted">
        When each thing needs touching again, counted from the day it was fitted.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[18px] border border-search-border bg-surface p-4">
          <p className="font-grotesk flex items-center gap-1.5 text-xs text-muted">
            <TriangleAlert size={12} className="text-red-500" />
            Overdue
          </p>
          <p className="font-heading mt-1 text-xl text-ink">{view.overdue}</p>
        </div>
        <div className="rounded-[18px] border border-search-border bg-surface p-4">
          <p className="font-grotesk flex items-center gap-1.5 text-xs text-muted">
            <CalendarClock size={12} className="text-amber-500" />
            Due within 90 days
          </p>
          <p className="font-heading mt-1 text-xl text-ink">{view.dueSoon}</p>
        </div>
        <div className="rounded-[18px] border border-search-border bg-surface p-4">
          <p className="font-grotesk flex items-center gap-1.5 text-xs text-muted">
            <CircleHelp size={12} className="text-faint" />
            No date yet
          </p>
          <p className="font-heading mt-1 text-xl text-ink">
            {view.unschedulable}
          </p>
          {view.unschedulable > 0 && (
            <p className="font-grotesk mt-0.5 text-[11px] text-muted">
              {/* Named as OUR gap, not theirs. The missing fact is usually a rated
                  life nobody put in the catalogue. */}
              We are missing an install date or a rated life for these.
            </p>
          )}
        </div>
      </div>

      {error && (
        <p className="font-grotesk mt-3 rounded-control border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      {requests.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <h3 className="font-heading text-sm text-ink">Your visit requests</h3>
          {requests.map((request) => (
            <div
              key={request.uuid}
              className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-search-border px-4 py-2.5"
            >
              <span className="font-grotesk text-sm text-ink">
                {request.reference}
              </span>
              <span className="font-grotesk text-xs text-muted">
                {SERVICE_REQUEST_STATUS_LABELS[request.status]}
                {request.scheduledFor && ` · ${request.scheduledFor}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="font-grotesk mt-4 rounded-[18px] border border-dashed border-search-border px-6 py-10 text-center text-sm text-muted">
          Nothing installed at this site yet.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-hairline-soft rounded-[18px] border border-search-border bg-surface px-6">
          {sorted.map((item) => (
            <ItemRow
              key={item.itemUuid}
              spaceUuid={spaceUuid}
              item={item}
              onError={setError}
            />
          ))}
        </div>
      )}

      {view.overdue > 0 && (
        <p className="font-grotesk mt-3 flex items-start gap-1.5 text-xs text-red-700">
          <CircleAlert size={12} className="mt-0.5 shrink-0" />
          An overdue sensor is a sensor that may not detect. The housing looks
          exactly the same either way, which is why the date matters.
        </p>
      )}
    </section>
  );
};
