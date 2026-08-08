"use client";

import {
  answerAction,
  claimAction,
  releaseAction,
} from "@/app/(dashboard)/expert-desk/action";
import type { ExpertQueue } from "@/db/enum";
import { EXPERT_QUEUE_LABELS, EXPERT_REQUEST_STATUS_LABELS } from "@/db/label";
import type { SelectExpertRequests } from "services";
import { FileText, Layers } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, Textarea } from "ui";

// A12. Two queues, never one list.
//
// A design question needs somebody who knows the engine; a datasheet needs
// somebody who knows the products. Mixed into one board, whoever opens it skims
// past most of it — which is how the queue that matters to them gets slower.

type QueueBoardProps = {
  queue: ExpertQueue;
  requests: SelectExpertRequests[];
};

type RequestCardProps = {
  request: SelectExpertRequests;
};

const RequestCard = ({ request }: RequestCardProps) => {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ error?: string }>): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await fn();
      if (result.error) {
        setError(result.error);
      }
    });
  };

  const lines = request.selection ?? [];

  return (
    <div className="flex flex-col gap-2 rounded-card border border-hairline bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{request.subject}</p>
          <p className="text-[11px] text-muted">
            {request.reference} · {request.askedByName ?? "Unknown"} ·{" "}
            {new Date(request.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-faint">
          {EXPERT_REQUEST_STATUS_LABELS[request.status]}
          {request.claimedBy && ` · ${request.claimedBy}`}
        </span>
      </div>

      <p className="text-xs whitespace-pre-wrap text-secondary">{request.body}</p>

      {/* The exact basket they were looking at. Without it an expert rebuilds it
          by hand, slightly differently, and answers a question nobody asked. */}
      {lines.length > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-faint">
          <Layers size={12} />
          {lines.length} line{lines.length === 1 ? "" : "s"} attached, exactly as
          they had them
        </p>
      )}

      {request.documentId && (
        <p className="flex items-center gap-1.5 text-[11px] text-faint">
          <FileText size={12} />
          Document {request.documentId}
        </p>
      )}

      {request.answer && (
        <div className="rounded-control border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2">
          <p className="text-[11px] font-medium text-emerald-400">
            {request.answeredBy} answered
          </p>
          <p className="text-xs whitespace-pre-wrap text-emerald-400">
            {request.answer}
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-control border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400">
          {error}
        </p>
      )}

      {request.status === "open" && (
        <div className="flex justify-end">
          <Button
            onClick={() => run(() => claimAction(request.uuid))}
            disabled={pending}
          >
            Take this one
          </Button>
        </div>
      )}

      {request.status === "claimed" && (
        <div className="flex flex-col gap-2">
          <Textarea
            label="Your answer"
            rows={3}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => run(() => releaseAction(request.uuid))}
              disabled={pending}
              className="rounded-control px-3 py-2 text-xs text-secondary hover:bg-hover hover:text-ink"
            >
              Hand it back
            </button>
            <Button
              onClick={() => run(() => answerAction(request.uuid, answer))}
              disabled={pending || answer.trim() === ""}
            >
              Send the answer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const QueueBoard = ({ queue, requests }: QueueBoardProps) => {
  const waiting = requests.filter((request) => request.status === "open");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-lg text-ink">
          {EXPERT_QUEUE_LABELS[queue]}
        </h2>
        <span className="text-xs text-muted">
          {waiting.length} waiting of {requests.length}
        </span>
      </div>

      {requests.length === 0 ? (
        <p className="rounded-card border border-dashed border-hairline px-4 py-8 text-center text-xs text-faint">
          Nothing here.
        </p>
      ) : (
        requests.map((request) => (
          <RequestCard key={request.uuid} request={request} />
        ))
      )}
    </div>
  );
};
