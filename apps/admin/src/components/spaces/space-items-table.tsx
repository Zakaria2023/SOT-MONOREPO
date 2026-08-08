"use client";

import { verifyFirmwareAction } from "@/app/(dashboard)/spaces/action";
import { BadgeCheck, CircleAlert, PackageX } from "lucide-react";
import { useState, useTransition } from "react";
import type { SpaceItemDetail } from "services";

// The register, with the one action only staff have: confirming a firmware version
// SOT has actually seen.
//
// That button is the whole reason this screen exists. Until it is pressed, a rule
// reading the version can only WARN — so a design that genuinely should be refused
// is passing with a note, and this is where somebody turns that into a real answer.
//
// Verifying is not undoable from here on purpose. Re-declaring the version resets
// the flag, which is the honest way back: the fix for a wrong confirmation is a new
// statement of what the version actually is, not a quiet un-ticking of the old one.

type SpaceItemsTableProps = {
  items: SpaceItemDetail[];
};

export const SpaceItemsTable = ({ items }: SpaceItemsTableProps) => {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const verify = (itemUuid: string): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await verifyFirmwareAction(itemUuid);
      if (result.error) {
        setError(result.error);
      }
    });
  };

  if (items.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-4 py-10 text-center text-sm text-faint">
        Nothing recorded at this site.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {items.map((item) => (
        <div
          key={item.uuid}
          className={`flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3 ${
            item.retiredAt ? "opacity-55" : ""
          }`}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">
              {item.name}
              {item.quantity > 1 && (
                <span className="text-faint"> × {item.quantity}</span>
              )}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
              {item.location ?? "location not recorded"}
              {item.installedAt && ` · installed ${item.installedAt}`}
              {item.serial && ` · ${item.serial}`}
              {/* Named because nothing about it can be checked any more, and a
                  register that hides it looks complete. */}
              {item.productUuid === null && (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <PackageX size={11} />
                  no longer in the catalogue
                </span>
              )}
              {item.retiredAt &&
                ` · replaced${item.retiredReason ? `: ${item.retiredReason}` : ""}`}
            </p>
          </div>

          {item.firmwareVersion !== null && item.retiredAt === null && (
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
                  item.firmwareVerified
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-amber-300 bg-amber-50 text-amber-900"
                }`}
              >
                {item.firmwareVerified ? (
                  <BadgeCheck size={11} />
                ) : (
                  <CircleAlert size={11} />
                )}
                {item.firmwareVersion}
              </span>

              {item.firmwareVerified ? (
                <span className="text-[11px] text-muted">
                  confirmed
                  {item.firmwareDeclaredBy && ` by ${item.firmwareDeclaredBy}`}
                </span>
              ) : (
                <>
                  <span className="text-[11px] text-muted">
                    {item.firmwareDeclaredBy
                      ? `told to us by ${item.firmwareDeclaredBy}`
                      : "unverified"}
                  </span>
                  <button
                    type="button"
                    onClick={() => verify(item.uuid)}
                    disabled={pending}
                    className="rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                  >
                    I have checked this
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
