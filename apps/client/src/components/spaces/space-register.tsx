"use client";

import {
  declareFirmwareAction,
  retireItemAction,
} from "@/app/spaces/[uuid]/actions";
import { BadgeCheck, CircleAlert, Cpu, MapPin, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { SpaceItemDetail } from "services";

// 6.1. The register of one site.
//
// The firmware control is the point of this component. It lets the customer tell
// us what they can see on a device, and it says out loud that we have not checked
// it — because that is what decides whether a rule reading the version may block a
// future design or only warn about it.
//
// A green tick alone would be a lie. "You told us 2.9" and "we confirmed 2.9" are
// different facts and the whole firmware model rests on keeping them apart, so
// they get different words and different colours rather than one badge.

type SpaceRegisterProps = {
  items: SpaceItemDetail[];
};

type RowProps = {
  item: SpaceItemDetail;
  onError: (message: string) => void;
};

const SpaceRow = ({ item, onError }: RowProps) => {
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState(item.firmwareVersion ?? "");
  const [pending, startTransition] = useTransition();

  const retired = item.retiredAt !== null;

  const save = (): void => {
    startTransition(async () => {
      const result = await declareFirmwareAction(item.uuid, version);
      if (result.error) {
        onError(result.error);
        return;
      }
      setEditing(false);
    });
  };

  const retire = (): void => {
    const reason = window.prompt(
      "Why is this coming out? The reason is what explains the next failure.",
    );
    if (reason === null || reason.trim() === "") {
      return;
    }
    startTransition(async () => {
      const result = await retireItemAction(item.uuid, reason);
      if (result.error) {
        onError(result.error);
      }
    });
  };

  return (
    <div
      className={`flex flex-col gap-2 py-4 ${retired ? "opacity-55" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-base text-ink">
            {item.productSlug ? (
              <Link
                href={`/products/${item.productSlug}`}
                className="hover:text-primary"
              >
                {item.name}
              </Link>
            ) : (
              item.name
            )}
            {item.quantity > 1 && (
              <span className="font-grotesk text-sm text-faint">
                {" "}
                × {item.quantity}
              </span>
            )}
          </p>

          <p className="font-grotesk mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {item.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} />
                {item.location}
              </span>
            )}
            {item.installedAt && <span>Installed {item.installedAt}</span>}
            {item.serial && <span className="font-mono">{item.serial}</span>}
          </p>

          {retired && (
            <p className="font-grotesk mt-1 text-xs text-muted">
              {/* Kept, not deleted. This line is what answers "how many of these
                  have failed". */}
              Replaced{item.retiredReason ? ` — ${item.retiredReason}` : ""}
            </p>
          )}
        </div>

        {!retired && (
          <button
            type="button"
            onClick={retire}
            disabled={pending}
            className="font-grotesk inline-flex shrink-0 items-center gap-1.5 rounded-full border border-search-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-60"
          >
            <Undo2 size={12} />
            Replaced
          </button>
        )}
      </div>

      {/* Firmware. Only offered on a row that stands for one device — a batch of
          twenty cannot have one firmware version, and the service refuses it, so
          offering the control here would be offering a button that errors. */}
      {!retired && item.quantity === 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <input
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="e.g. 2.15.4"
                className="font-grotesk w-32 rounded-control border border-search-border bg-surface px-2.5 py-1 text-xs text-ink"
              />
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="font-grotesk rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="font-grotesk text-xs text-muted hover:text-ink"
              >
                Cancel
              </button>
            </>
          ) : item.firmwareVersion === null ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-grotesk inline-flex items-center gap-1.5 rounded-full border border-dashed border-search-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-primary"
            >
              <Cpu size={12} />
              Add firmware version
            </button>
          ) : (
            <>
              <span
                className={`font-grotesk inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                  item.firmwareVerified
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {item.firmwareVerified ? (
                  <BadgeCheck size={12} />
                ) : (
                  <CircleAlert size={12} />
                )}
                {item.firmwareVersion}
                {" · "}
                {item.firmwareVerified
                  ? "confirmed by SOT"
                  : "as you told us, not checked"}
              </span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="font-grotesk text-xs text-muted hover:text-primary"
              >
                Change
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const SpaceRegister = ({ items }: SpaceRegisterProps) => {
  const [error, setError] = useState<string>();

  if (items.length === 0) {
    return (
      <p className="font-grotesk mt-6 rounded-[18px] border border-dashed border-search-border px-6 py-10 text-center text-sm text-muted">
        Nothing recorded at this site yet.
      </p>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="font-heading text-lg text-ink">Installed equipment</h2>
      <p className="font-grotesk mt-0.5 text-sm text-muted">
        Built from your installer&apos;s handover record. Telling us a firmware
        version helps us check future additions against what you already have.
      </p>

      {error && (
        <p className="font-grotesk mt-3 rounded-control border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-3 divide-y divide-hairline-soft rounded-[18px] border border-search-border bg-surface px-6">
        {items.map((item) => (
          <SpaceRow key={item.uuid} item={item} onError={setError} />
        ))}
      </div>
    </section>
  );
};
