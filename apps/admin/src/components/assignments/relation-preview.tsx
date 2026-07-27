"use client";

import {
  previewRelationAction,
  searchProductsAction,
  type ProductPickerItem,
  type RelationshipPreview,
} from "@/app/(dashboard)/assignments/actions";
import type { RelationVariable } from "@/components/assignments/relation-builder";
import { Field, FieldSet } from "@/components/shared/field";
import type { SelectRelationships } from "@/db/schema/relationships";
import type { Operand } from "@/db/types";
import { Minus, Plus, Search, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { Button, Dropdown, Input, useDebouncedCallback } from "ui";
import type { FindingStatus } from "services";

// ---------------------------------------------------------------------------
// HOW A RULE GETS REVIEWED.
//
// A rule that has only ever been read cannot be trusted — the author knows what
// they meant, not what the evaluator will do with it. So the author points it at
// a real basket and reads the sentence the buyer would read. This replaced a
// draft state that reviewed nothing: a rule sitting unpublished is a gate
// somebody believes is protecting them while it protects nothing.
//
// This runs the SAME evaluator the checkout gate runs. Not an approximation of
// it, not a second implementation: `previewRelationship` loads the real products
// and calls `evaluateRelationship`. What is shown here is what will happen.
// ---------------------------------------------------------------------------

type RelationPreviewProps = {
  relation: SelectRelationships;
  variables: RelationVariable[];
  onClose: () => void;
};

type Line = {
  productUuid: string;
  name: string;
  quantity: number;
};

const STATUS_STYLE: Record<FindingStatus, string> = {
  pass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  block: "border-red-500/30 bg-red-500/10 text-red-400",
  unknown: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  not_applicable: "border-hairline bg-hover text-secondary",
};

const STATUS_LABEL: Record<FindingStatus, string> = {
  pass: "Passes",
  warn: "Warns the buyer",
  block: "Blocks the order",
  unknown: "Cannot be judged",
  not_applicable: "Does not apply",
};

// Which project inputs this rule actually reads. Asking for every variable in
// the system would bury the one or two that change the answer.
const referencedVariables = (row: SelectRelationships): Set<string> => {
  const found = new Set<string>();
  const fromOperand = (operand: Operand | null | undefined): void => {
    if (operand?.source === "variable") {
      found.add(operand.variableUuid);
    }
  };
  fromOperand(row.consumer);
  fromOperand(row.provider);
  for (const requirement of row.presence?.requires ?? []) {
    for (const alternative of requirement.satisfiedBy) {
      if (alternative.type === "variable_true") {
        found.add(alternative.variableUuid);
      }
    }
  }
  return found;
};

export const RelationPreview = ({
  relation,
  variables,
  onClose,
}: RelationPreviewProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductPickerItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | boolean>>({});
  const [preview, setPreview] = useState<RelationshipPreview>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);

  // Blank means "unanswered", which is not the same as zero — an unanswered
  // variable falls back to its default, and with no default the rule does not
  // run. So clearing a box has to remove the key, not set it to 0.
  const answer = (uuid: string, value: number | boolean | null): void => {
    setPreview(undefined);
    setAnswers((current) => {
      const next = { ...current };
      if (value === null) {
        delete next[uuid];
        return next;
      }
      next[uuid] = value;
      return next;
    });
  };

  const asked = variables.filter((variable) =>
    referencedVariables(relation).has(variable.uuid),
  );

  const search = useDebouncedCallback(async (term: string) => {
    setSearching(true);
    try {
      setResults(await searchProductsAction(term));
    } finally {
      setSearching(false);
    }
  }, 250);

  const changeQuery = (term: string): void => {
    setQuery(term);
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    search(term);
  };

  const addLine = (product: ProductPickerItem): void => {
    // Adding the same product twice is a quantity change, not a second line —
    // the evaluator sums them anyway, so two lines would only be confusing.
    setLines((current) =>
      current.some((line) => line.productUuid === product.uuid)
        ? current.map((line) =>
            line.productUuid === product.uuid
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          )
        : [
            ...current,
            { productUuid: product.uuid, name: product.name, quantity: 1 },
          ],
    );
    setPreview(undefined);
    setQuery("");
    setResults([]);
  };

  const setQuantity = (productUuid: string, quantity: number): void => {
    setPreview(undefined);
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.productUuid !== productUuid)
        : current.map((line) =>
            line.productUuid === productUuid ? { ...line, quantity } : line,
          ),
    );
  };

  const run = async (): Promise<void> => {
    setError(undefined);
    setRunning(true);
    try {
      const result = await previewRelationAction(
        relation.uuid,
        lines.map((line) => ({
          productUuid: line.productUuid,
          quantity: line.quantity,
        })),
        answers,
      );
      if (result.error) {
        setError(result.error);
        setPreview(undefined);
        return;
      }
      setPreview(result.preview);
    } finally {
      setRunning(false);
    }
  };

  const finding = preview?.finding;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-primary/40 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            Try “{relation.name}” against a real basket
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Runs the same evaluator checkout runs, on a basket you choose.
            Nothing here changes the rule or anyone&apos;s cart.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the preview"
          className="shrink-0 rounded-control p-1.5 text-faint hover:bg-hover hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>

      <FieldSet title="The basket">
        <Input
          icon={<Search size={15} />}
          placeholder="Search products by name, SKU, or model…"
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
        />

        {query.trim().length >= 2 && (
          <div className="flex flex-col gap-1">
            {searching && <p className="text-[11px] text-faint">Searching…</p>}
            {!searching && results.length === 0 && (
              <p className="text-[11px] text-faint">Nothing matched.</p>
            )}
            {results.map((product) => (
              <button
                key={product.uuid}
                type="button"
                onClick={() => addLine(product)}
                className="flex items-center gap-2 rounded-control px-2 py-1.5 text-left text-xs text-ink hover:bg-hover"
              >
                <Plus size={12} className="shrink-0 text-primary" />
                <span className="min-w-0 flex-1 line-clamp-1">
                  {product.name}
                </span>
                {product.categoryName && (
                  <span className="shrink-0 text-[11px] text-faint">
                    {product.categoryName}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {lines.length === 0 ? (
          <p className="rounded-control border border-dashed border-hairline px-3 py-6 text-center text-[11px] text-faint">
            Add the products whose combination you want to try.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {lines.map((line) => (
              <div
                key={line.productUuid}
                className="flex items-center gap-2 rounded-control border border-hairline bg-base px-2.5 py-1.5"
              >
                <span className="min-w-0 flex-1 text-xs text-ink line-clamp-1">
                  {line.name}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(line.productUuid, line.quantity - 1)
                    }
                    aria-label={`One fewer ${line.name}`}
                    className="rounded-control p-1 text-faint hover:bg-hover hover:text-ink"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-8 text-center text-xs font-medium text-ink">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(line.productUuid, line.quantity + 1)
                    }
                    aria-label={`One more ${line.name}`}
                    className="rounded-control p-1 text-faint hover:bg-hover hover:text-ink"
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuantity(line.productUuid, 0)}
                    aria-label={`Remove ${line.name}`}
                    className="rounded-control p-1 text-faint hover:bg-hover hover:text-red-400"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </FieldSet>

      {asked.length > 0 && (
        <FieldSet
          title="What the buyer told us"
          hint="This rule reads these answers. Left blank, it uses the default — and with no default, the rule does not run at all."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {asked.map((variable) =>
              variable.type === "boolean" ? (
                <Field key={variable.uuid} label={variable.label}>
                  <Dropdown
                    value={
                      answers[variable.uuid] === undefined
                        ? ""
                        : answers[variable.uuid]
                          ? "true"
                          : "false"
                    }
                    onChange={(next) =>
                      answer(
                        variable.uuid,
                        next === "" ? null : next === "true",
                      )
                    }
                    options={[
                      { value: "", label: "Not answered" },
                      { value: "true", label: "Yes" },
                      { value: "false", label: "No" },
                    ]}
                    placeholder="Not answered"
                  />
                </Field>
              ) : (
                <Input
                  key={variable.uuid}
                  label={variable.label}
                  type="number"
                  value={
                    answers[variable.uuid] === undefined
                      ? ""
                      : String(answers[variable.uuid])
                  }
                  onChange={(event) =>
                    answer(
                      variable.uuid,
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                  rightSlot={
                    variable.unit ? (
                      <span className="text-xs text-faint">
                        {variable.unit}
                      </span>
                    ) : undefined
                  }
                />
              ),
            )}
          </div>
        </FieldSet>
      )}

      {error && (
        <p className="rounded-card border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={run} disabled={running || lines.length === 0}>
          {running ? "Running…" : "Run the check"}
        </Button>
      </div>

      {finding && (
        <div className="flex flex-col gap-3 border-t border-hairline pt-4">
          <p className="text-[11px] text-muted">{preview?.summary}</p>

          <div
            className={`flex flex-col gap-1 rounded-card border px-3 py-2.5 ${STATUS_STYLE[finding.status]}`}
          >
            <span className="text-[11px] font-semibold tracking-wide uppercase">
              {STATUS_LABEL[finding.status]}
            </span>
            {/* The buyer's own words, verbatim. If this sentence does not make
                sense here, it will not make sense at checkout either. */}
            <p className="text-xs">{finding.message}</p>
          </div>

          {finding.status !== "not_applicable" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-control border border-hairline px-2.5 py-2">
                <p className="text-[10px] tracking-wide text-faint uppercase">
                  Demand
                </p>
                <p className="text-sm text-ink">
                  {finding.demand}
                  {finding.unit && (
                    <span className="ml-1 text-xs text-faint">
                      {finding.unit}
                    </span>
                  )}
                </p>
              </div>
              <div className="rounded-control border border-hairline px-2.5 py-2">
                <p className="text-[10px] tracking-wide text-faint uppercase">
                  Capacity
                </p>
                <p className="text-sm text-ink">
                  {finding.capacity}
                  {finding.unit && (
                    <span className="ml-1 text-xs text-faint">
                      {finding.unit}
                    </span>
                  )}
                </p>
              </div>
              {finding.effectiveCapacity !== finding.capacity && (
                <div className="rounded-control border border-hairline px-2.5 py-2">
                  <p className="text-[10px] tracking-wide text-faint uppercase">
                    After headroom
                  </p>
                  <p className="text-sm text-ink">
                    {finding.effectiveCapacity}
                    {finding.unit && (
                      <span className="ml-1 text-xs text-faint">
                        {finding.unit}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Never swallowed: an item the rule matched but could not read is the
              one failure mode that otherwise looks exactly like approval. */}
          {finding.skipped.length > 0 && (
            <div className="flex flex-col gap-1 rounded-card border border-blue-500/30 bg-blue-500/10 px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-blue-400">
                <TriangleAlert size={12} />
                Matched but missing values
              </span>
              {finding.skipped.map((item) => (
                <p key={item.productUuid} className="text-[11px] text-blue-400">
                  {item.name} — no {item.missing.join(", ")}
                </p>
              ))}
            </div>
          )}

          {(finding.consumers.length > 0 || finding.providers.length > 0) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { title: "Counted as demand", items: finding.consumers },
                { title: "Counted as capacity", items: finding.providers },
              ]
                .filter((side) => side.items.length > 0)
                .map((side) => (
                  <div key={side.title} className="flex flex-col gap-1">
                    <span className="text-[10px] tracking-wide text-faint uppercase">
                      {side.title}
                    </span>
                    {side.items.map((item) => (
                      <p
                        key={item.productUuid}
                        className="flex items-baseline justify-between gap-2 text-[11px] text-secondary"
                      >
                        <span className="min-w-0 line-clamp-1">
                          {item.quantity} × {item.name}
                        </span>
                        <span className="shrink-0 font-mono text-faint">
                          {item.totalValue}
                          {finding.unit ?? ""}
                        </span>
                      </p>
                    ))}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
