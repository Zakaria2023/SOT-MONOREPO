import { Check, CircleDot, Circle, TriangleAlert } from "lucide-react";
import { buildOrderTracking, describeStage } from "services";
import type { BoqStatus, OrderStatus } from "@/db/enum";

// E9. Where the order has got to, and — the part that matters — who it is
// waiting on.
//
// Read from the same lifecycle the partner's work list reads, so the two screens
// cannot tell two different stories about one job. A test in the services package
// holds them together.
//
// The waiting line comes FIRST, above the steps. A timeline answers "how far
// along am I"; it does not answer "is anything expected of me", and the second is
// the question that generates the phone call. An order sitting unpaid for a week
// is waiting on the customer, and a bar showing step 4 of 7 has told them the
// opposite.

type OrderTrackingProps = {
  orderStatus: OrderStatus;
  boqStatus: BoqStatus | null;
};

const TONE: Record<string, string> = {
  you: "border-amber-200 bg-amber-50 text-amber-900",
  sot: "border-search-border bg-hover text-ink",
  installer: "border-sky-200 bg-sky-50 text-sky-900",
};

export const OrderTracking = ({
  orderStatus,
  boqStatus,
}: OrderTrackingProps) => {
  const tracking = buildOrderTracking({ orderStatus, boqStatus });

  // A cancelled order gets a sentence, not a ladder. Seven steps drawn against it
  // would say it is still moving.
  if (tracking.stopped) {
    return (
      <div className="flex items-center gap-2 rounded-[18px] border border-search-border bg-hover px-5 py-4">
        <TriangleAlert size={16} className="shrink-0 text-muted" />
        <p className="font-grotesk text-sm text-muted">
          {tracking.waitingLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-[18px] border border-search-border bg-surface p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`font-grotesk rounded-full border px-3 py-1 text-xs font-medium ${
            tracking.waitingOn
              ? TONE[tracking.waitingOn]
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {tracking.waitingLabel}
        </span>
        <p className="font-grotesk text-sm text-muted">
          {orderStatus === "awaiting_payment"
            ? "Settle the amount below to move this on."
            : describeStage(boqStatus)}
        </p>
      </div>

      <ol className="flex flex-col gap-0">
        {tracking.steps.map((step, index) => (
          <li key={step.number} className="flex gap-3">
            <div className="flex flex-col items-center">
              {step.state === "done" ? (
                <Check size={16} className="shrink-0 text-primary" />
              ) : step.state === "current" ? (
                <CircleDot size={16} className="shrink-0 text-primary" />
              ) : (
                <Circle size={16} className="shrink-0 text-faint" />
              )}
              {/* No connector under the last step — a line running off the end
                  implies another stage nobody has been told about. */}
              {index < tracking.steps.length - 1 && (
                <span
                  className={`h-full min-h-6 w-px ${
                    step.state === "done" ? "bg-primary" : "bg-hairline-soft"
                  }`}
                />
              )}
            </div>
            <div className="pb-5">
              <p
                className={`font-grotesk text-sm ${
                  step.state === "upcoming"
                    ? "text-faint"
                    : "font-medium text-ink"
                }`}
              >
                {step.title}
              </p>
              {/* Only the current step explains itself. Describing all seven
                  turns a status into a wall of text nobody reads. */}
              {step.state === "current" && (
                <p className="font-grotesk mt-0.5 text-xs text-muted">
                  {step.description}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};
