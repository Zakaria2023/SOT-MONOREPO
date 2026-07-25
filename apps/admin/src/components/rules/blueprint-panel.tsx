"use client";

import { installBlueprintAction } from "@/app/(dashboard)/rules/actions";
import type { RuleBlueprintStatus } from "@/app/(dashboard)/rules/action";
import { RULE_KIND_LABELS } from "@/db/label";
import { BookOpen, Check, Download, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { FormError } from "ui";

type BlueprintPanelProps = {
  blueprints: RuleBlueprintStatus[];
};

type BlueprintRowProps = {
  blueprint: RuleBlueprintStatus;
  pending: boolean;
  onInstall: (id: string) => void;
};

const BlueprintRow = ({ blueprint, pending, onInstall }: BlueprintRowProps) => {
  const ready = blueprint.missing.length === 0;

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{blueprint.name}</span>
            <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium text-secondary">
              {RULE_KIND_LABELS[blueprint.kind]}
            </span>
            {blueprint.severity === "warn" && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                Warning
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">{blueprint.description}</p>
          <p className="mt-1 text-xs text-faint">{blueprint.rationale}</p>
        </div>

        {blueprint.installed ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-control bg-page px-3 py-2 text-xs font-semibold text-muted">
            <Check size={14} />
            Installed
          </span>
        ) : (
          <button
            type="button"
            disabled={!ready || pending}
            onClick={() => onInstall(blueprint.id)}
            className="flex shrink-0 items-center gap-1.5 rounded-control border border-hairline px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={14} />
            Install
          </button>
        )}
      </div>

      {!blueprint.installed && !ready && (
        <p className="flex items-start gap-1.5 rounded-control bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <TriangleAlert size={13} className="mt-0.5 shrink-0" />
          <span>
            Needs {blueprint.missing.length === 1 ? "an attribute" : "attributes"}{" "}
            the library doesn&apos;t have yet:{" "}
            <span className="font-semibold">
              {blueprint.missing.join(", ")}
            </span>
            . Create {blueprint.missing.length === 1 ? "it" : "them"} in the
            spec library first — the rule binds by key.
          </span>
        </p>
      )}
    </li>
  );
};

export const BlueprintPanel = ({ blueprints }: BlueprintPanelProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(
    // Opened by default while nothing is installed, since an empty rules table
    // is exactly when this list is worth reading.
    blueprints.every((blueprint) => !blueprint.installed),
  );

  const install = (id: string) =>
    startTransition(async () => {
      const result = await installBlueprintAction(id);
      setError(result.error);
    });

  const ready = blueprints.filter(
    (blueprint) => !blueprint.installed && blueprint.missing.length === 0,
  ).length;
  const installed = blueprints.filter((blueprint) => blueprint.installed).length;

  return (
    <div className="rounded-card border border-hairline bg-surface p-5 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-control bg-primary-tint text-primary">
          <BookOpen size={17} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">
            Researched rules ({blueprints.length})
          </p>
          <p className="text-xs text-muted">
            {installed} installed · {ready} ready to install ·{" "}
            {blueprints.length - installed - ready} waiting on library
            attributes
          </p>
        </div>
        <span className="text-xs font-semibold text-primary">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="mt-4 border-t border-hairline pt-2">
          <FormError message={error} />
          <ul className="flex flex-col divide-y divide-hairline">
            {blueprints.map((blueprint) => (
              <BlueprintRow
                key={blueprint.id}
                blueprint={blueprint}
                pending={isPending}
                onInstall={install}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
