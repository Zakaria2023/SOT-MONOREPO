"use client";

import { advanceJobAction } from "@/app/(dashboard)/work/actions";
import type { BoqStatus } from "@/db/enum";
import type { PartnerBoqListItem, WorkItem } from "services";
import { ArrowRight, Clock, CheckCircle2, Hourglass } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

// P8. One list, ordered by what is blocking somebody.
//
// Grouped by urgency rather than by date, because a job sitting unstarted is
// worth more attention than one being worked on — and newest-first would bury
// the one that has been stuck longest, which is exactly the one to chase.
//
// A job that is not the partner's to move shows no button and says who it is
// waiting on. A disabled button teaches somebody the app is broken; "waiting on
// our verification" tells them it is not theirs.

type WorkBoardProps = {
  items: WorkItem<PartnerBoqListItem>[];
};

const GROUPS: {
  urgency: WorkItem<PartnerBoqListItem>["urgency"];
  title: string;
  blurb: string;
}[] = [
  {
    urgency: "do_now",
    title: "Not started",
    blurb: "Dispatched to you and waiting. Nothing is happening on these yet.",
  },
  {
    urgency: "scheduled",
    title: "In progress",
    blurb: "On site now.",
  },
  {
    urgency: "waiting_on_us",
    title: "Waiting on SOT",
    blurb: "Your part is finished. These are on our desk, not yours.",
  },
  { urgency: "done", title: "Handed over", blurb: "Closed." },
];

const NEXT_LABEL: Partial<Record<BoqStatus, string>> = {
  installing: "Start on site",
  installed: "Mark finished",
};

export const WorkBoard = ({ items }: WorkBoardProps) => {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const move = (boqUuid: string, next: BoqStatus): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await advanceJobAction(boqUuid, next);
      if (result.error) {
        setError(result.error);
      }
    });
  };

  if (items.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-4 py-12 text-center text-sm text-faint">
        Nothing dispatched to you yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {error && (
        <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {GROUPS.map((group) => {
        const inGroup = items.filter((item) => item.urgency === group.urgency);
        if (inGroup.length === 0) {
          return null;
        }

        return (
          <div key={group.urgency} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-heading text-lg">
                {group.title}
                <span className="ml-2 text-sm text-faint">{inGroup.length}</span>
              </h2>
            </div>
            <p className="text-xs text-muted">{group.blurb}</p>

            {inGroup.map((item) => (
              <div
                key={item.job.uuid}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/boqs/${item.job.uuid}`}
                    className="text-sm font-medium hover:text-primary"
                  >
                    {item.job.reference}
                  </Link>
                  <p className="flex items-center gap-1.5 text-[11px] text-muted">
                    {item.urgency === "do_now" && <Clock size={11} />}
                    {item.urgency === "waiting_on_us" && <Hourglass size={11} />}
                    {item.urgency === "done" && <CheckCircle2 size={11} />}
                    Stage {item.stageNumber} · {item.stageTitle} ·{" "}
                    {item.callToAction}
                  </p>
                </div>

                {/* No button where the move is not theirs — the sentence above
                    already says who it is waiting on. */}
                {item.actions.length > 0 && (
                  <div className="flex shrink-0 gap-2">
                    {item.actions.map((next) => (
                      <button
                        key={next}
                        type="button"
                        onClick={() => move(item.job.uuid, next)}
                        disabled={pending}
                        className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                      >
                        {NEXT_LABEL[next] ?? next}
                        <ArrowRight size={13} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
