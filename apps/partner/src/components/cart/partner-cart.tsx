"use client";

import {
  orderAsStockAction,
  sendAsBoqAction,
  type PartnerCartView,
} from "@/app/(dashboard)/cart/actions";
import { CircleSlash, ShoppingCart } from "lucide-react";
import { useState, useTransition } from "react";
import { formatMoney, lineTotal } from "utils";

// P5. The same basket, three possible transactions.
//
// A closed destination is shown greyed with its reason rather than hidden.
// Hiding it leaves somebody hunting for a button that was never there; saying
// "buying stock needs the may-hold-stock capability" sends them to the person
// who can grant it.

type PartnerCartProps = {
  view: PartnerCartView;
};

export const PartnerCart = ({ view }: PartnerCartProps) => {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const currency = view.lines[0]?.currency ?? "SAR";
  const priced = view.lines.filter(
    (line) => line.unitPrice !== null && line.unitPrice !== "",
  );
  const subtotal = priced.reduce(
    (sum, line) => sum + lineTotal(line.unitPrice, line.quantity),
    0,
  );
  const unpriced = view.lines.length - priced.length;

  const send = (destination: string): void => {
    setError(undefined);
    startTransition(async () => {
      const result =
        destination === "order"
          ? await orderAsStockAction()
          : destination === "boq"
            ? await sendAsBoqAction(view.lines[0]?.categoryUuid ?? "")
            : { error: "Quoting is not built yet." };
      if (result.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-card border border-hairline bg-surface p-5">
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} className="text-primary" />
          <h2 className="font-heading text-lg">
            {view.lines.length} item{view.lines.length === 1 ? "" : "s"}
          </h2>
        </div>

        <div className="mt-4 divide-y divide-hairline border-y border-hairline">
          {view.lines.map((line) => (
            <div
              key={line.uuid}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm line-clamp-1">{line.name}</p>
                <p className="text-xs text-muted">
                  {line.quantity} ×{" "}
                  {line.unitPrice
                    ? formatMoney(Number(line.unitPrice), currency)
                    : "no price yet"}
                </p>
              </div>
              <span className="shrink-0 text-sm tabular-nums">
                {line.unitPrice
                  ? formatMoney(lineTotal(line.unitPrice, line.quantity), currency)
                  : "—"}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-sm text-muted">
            Subtotal at list
            {view.discountPercent > 0 && ` · your discount is ${view.discountPercent}%`}
          </span>
          <span className="font-heading text-xl tabular-nums">
            {formatMoney(subtotal, currency)}
          </span>
        </div>

        {unpriced > 0 && (
          <p className="mt-1 text-xs text-amber-600">
            {unpriced} item{unpriced === 1 ? " has" : "s have"} no price yet and
            {unpriced === 1 ? " is" : " are"} not in that total.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {view.destinations.map((offer) => (
          <button
            key={offer.destination}
            type="button"
            onClick={() => send(offer.destination)}
            disabled={!offer.available || pending}
            className={`flex flex-col items-start gap-0.5 rounded-card border px-4 py-3 text-left transition-colors ${
              offer.available
                ? "border-primary/40 bg-surface hover:bg-primary-tint"
                : "cursor-not-allowed border-hairline bg-base"
            }`}
          >
            <span
              className={`flex items-center gap-1.5 text-sm font-medium ${
                offer.available ? "text-ink" : "text-faint"
              }`}
            >
              {!offer.available && <CircleSlash size={13} />}
              {offer.label}
            </span>
            {/* The reason, not a disabled button with no explanation. */}
            {offer.reason && (
              <span className="text-xs text-muted">{offer.reason}</span>
            )}
          </button>
        ))}
      </div>

      {view.capabilities.length > 0 && (
        <p className="text-xs text-faint">
          This account is approved for: {view.capabilities.join(", ")}.
        </p>
      )}
    </div>
  );
};
