"use client";

import {
  addRelation,
  removeRelation,
  type SpecRelation,
} from "@/app/(dashboard)/assignments/actions";
import { LookupEditor } from "@/components/assignments/lookup-editor";
import type { LookupRow } from "@/db/types";
import type { RuleComparator, RuleKind } from "@/db/enum";
import { ruleKinds } from "@/db/enum";
import { RULE_KIND_LABELS } from "@/db/label";
import { Plus, Trash2, Zap } from "lucide-react";
import { useState, useTransition } from "react";
import { Dropdown, FormError, Input } from "ui";

type RelationSectionProps = {
  // The attribute this card is for.
  specUuid: string;
  specLabel: string;
  specUnit: string | null;
  // Rules already touching it.
  relations: SpecRelation[];
  // Every other attribute, to pick the far side from.
  otherSpecs: { value: string; label: string }[];
  // Attributes with option lists, for keying a conditional rule's table.
  lookupSpecs: { key: string; label: string; options: string[] }[];
};

const COMPARATOR_LABELS: Record<RuleComparator, string> = {
  lte: "must fit within (≤)",
  gte: "must be at least (≥)",
  eq: "must equal (=)",
  in: "must be one of (∈)",
  intersects: "must overlap (∩)",
};

const CARD_KINDS = ruleKinds;

export const RelationSection = ({
  specUuid,
  specLabel,
  specUnit,
  relations,
  otherSpecs,
  lookupSpecs,
}: RelationSectionProps) => {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const [adding, setAdding] = useState(false);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<RuleKind>("sum_budget");
  const [side, setSide] = useState<"demand" | "supply">("demand");
  const [otherSpecUuid, setOtherSpecUuid] = useState("");
  const [comparator, setComparator] = useState<RuleComparator>("lte");
  const [headroomPercent, setHeadroomPercent] = useState(100);
  const [severity, setSeverity] = useState<"block" | "warn">("block");
  const [lookupInputs, setLookupInputs] = useState<string[]>([]);
  const [lookupRows, setLookupRows] = useState<LookupRow[]>([]);

  const reset = () => {
    setName("");
    setKind("sum_budget");
    setSide("demand");
    setOtherSpecUuid("");
    setComparator("lte");
    setHeadroomPercent(100);
    setSeverity("block");
    setLookupInputs([]);
    setLookupRows([]);
    setAdding(false);
  };

  const submit = () =>
    startTransition(async () => {
      const result = await addRelation({
        name: name.trim(),
        kind,
        specUuid,
        side,
        otherSpecUuid,
        comparator,
        headroomPercent,
        severity,
        lookupInputs,
        lookupRows,
      });
      setError(result.error);
      if (!result.error) {
        reset();
      }
    });

  const drop = (uuid: string) =>
    startTransition(async () => {
      const result = await removeRelation(uuid);
      setError(result.error);
    });

  const isMatch = kind === "spec_match";
  // A conditional rule reads its limit from its own table, so it has no far
  // side to pick — the table IS the capacity.
  const isConditional = kind === "conditional";

  return (
    <div className="flex flex-col gap-2 border-t border-hairline pt-2.5">
      <span className="flex items-center gap-1 text-sm font-semibold text-muted">
        <Zap size={14} />
        Relations
        <span className="font-normal text-faint">
          — what this attribute is compared against
        </span>
      </span>

      <FormError message={error} />

      {relations.length > 0 && (
        <ul className="flex flex-col gap-1">
          {relations.map((relation) => (
            <li
              key={`${relation.uuid}-${relation.side}`}
              className="flex flex-wrap items-center gap-1.5 rounded-md bg-surface px-2 py-1.5 text-sm"
            >
              <span className="font-semibold text-ink">{relation.name}</span>
              <span className="rounded bg-page px-1 py-0.5 text-sm text-muted">
                {RULE_KIND_LABELS[relation.kind]}
              </span>
              <span className="text-muted">
                {relation.side === "demand" ? "demand" : "capacity"} ·{" "}
                {relation.kind === "conditional"
                  ? "vs its lookup table"
                  : `vs ${relation.otherSpecLabel ?? "—"}`}
              </span>
              {relation.severity === "warn" && (
                <span className="rounded bg-amber-50 px-1 py-0.5 text-sm font-medium text-amber-700">
                  soft
                </span>
              )}
              <button
                type="button"
                disabled={isPending}
                onClick={() => drop(relation.uuid)}
                aria-label={`Delete ${relation.name}`}
                className="ml-auto rounded p-1 text-faint transition-colors hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="flex flex-col gap-2 rounded-md border border-primary/40 bg-surface p-2.5">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Relation name — e.g. PoE power budget"
          />

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Dropdown
              value={kind}
              onChange={(value) => setKind(value as RuleKind)}
              options={CARD_KINDS.map((value) => ({
                value,
                label: RULE_KIND_LABELS[value],
              }))}
            />
            {isConditional ? (
              <p className="flex items-center rounded-control border border-dashed border-hairline px-3 text-sm text-faint">
                {specLabel} is measured against its own table
              </p>
            ) : (
              <Dropdown
                value={side}
                onChange={(value) => setSide(value as "demand" | "supply")}
                options={[
                  {
                    value: "demand",
                    label: `${specLabel} is the demand`,
                  },
                  {
                    value: "supply",
                    label: `${specLabel} is the capacity`,
                  },
                ]}
              />
            )}
          </div>

          {isConditional ? (
            <LookupEditor
              inputs={lookupInputs}
              rows={lookupRows}
              inputOptions={lookupSpecs.map((spec) => ({
                value: spec.key,
                label: spec.label,
              }))}
              valuesByKey={Object.fromEntries(
                lookupSpecs.map((spec) => [spec.key, spec.options]),
              )}
              limitUnit={specUnit}
              onChange={(inputs, rows) => {
                setLookupInputs(inputs);
                setLookupRows(rows);
              }}
            />
          ) : (
            <Dropdown
              searchable
              value={otherSpecUuid}
              onChange={setOtherSpecUuid}
              placeholder={
                side === "demand"
                  ? "…measured against which capacity?"
                  : "…which demand draws on it?"
              }
              searchPlaceholder="Search attributes…"
              options={otherSpecs}
            />
          )}

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <Dropdown
              value={comparator}
              onChange={(value) => setComparator(value as RuleComparator)}
              options={(isMatch
                ? (["in", "intersects", "eq", "lte", "gte"] as RuleComparator[])
                : (["lte", "gte", "eq"] as RuleComparator[])
              ).map((value) => ({
                value,
                label: COMPARATOR_LABELS[value],
              }))}
            />
            {!isMatch && (
              <Input
                type="number"
                min={1}
                max={100}
                value={String(headroomPercent)}
                onChange={(event) =>
                  setHeadroomPercent(Number(event.target.value))
                }
                placeholder="Usable %"
              />
            )}
            <Dropdown
              value={severity}
              onChange={(value) => setSeverity(value as "block" | "warn")}
              options={[
                { value: "block", label: "Hard — blocks" },
                { value: "warn", label: "Soft — warns" },
              ]}
            />
          </div>

          {specUnit && (
            <p className="text-sm text-faint">
              {specLabel} is measured in {specUnit} — the other side must use
              the same unit, except on a Count relation.
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={
                isPending ||
                !name.trim() ||
                (isConditional ? lookupRows.length === 0 : !otherSpecUuid)
              }
              onClick={submit}
              className="rounded-control bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Add relation"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="text-xs text-secondary hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-fit items-center gap-1 rounded-md border border-hairline px-2 py-1 text-sm font-medium text-muted transition-colors hover:border-primary hover:text-primary"
        >
          <Plus size={14} />
          Add relation
        </button>
      )}
    </div>
  );
};
