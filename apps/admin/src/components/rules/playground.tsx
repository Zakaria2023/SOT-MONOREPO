"use client";

import { checkCompatibilityAction } from "@/app/(dashboard)/rules/actions";
import {
  CheckCircle2,
  CircleSlash,
  Lightbulb,
  Minus,
  Play,
  Plus,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { useState, useTransition } from "react";
import { Button, FormError } from "ui";
import type {
  CompatibilityReport,
  ProductListItem,
  ProjectVariableListItem,
  RuleEvaluation,
  RuleStatus,
} from "services";

type PlaygroundProps = {
  products: ProductListItem[];
  // The design questions a rule may read. Without answers here, any rule
  // bound to a variable reports not_applicable — which is correct, but makes
  // the playground look like the rule is broken, so they're editable.
  variables: ProjectVariableListItem[];
};

type StatusStyle = {
  chip: string;
  border: string;
  label: string;
};

type StatusIconProps = {
  status: RuleStatus;
};

type ResultCardProps = {
  result: RuleEvaluation;
};

const STATUS_STYLES: Record<RuleStatus, StatusStyle> = {
  pass: {
    chip: "bg-emerald-50 text-emerald-700",
    border: "border-emerald-200",
    label: "Pass",
  },
  warn: {
    chip: "bg-amber-50 text-amber-700",
    border: "border-amber-200",
    label: "Warning",
  },
  fail: {
    chip: "bg-red-50 text-red-700",
    border: "border-red-200",
    label: "Incompatible",
  },
  not_applicable: {
    chip: "bg-hover text-faint",
    border: "border-hairline",
    label: "Not applicable",
  },
};

const StatusIcon = ({ status }: StatusIconProps) => {
  if (status === "pass") {
    return <CheckCircle2 size={16} className="text-emerald-600" />;
  }
  if (status === "warn") {
    return <TriangleAlert size={16} className="text-amber-600" />;
  }
  if (status === "fail") {
    return <XCircle size={16} className="text-red-600" />;
  }
  return <CircleSlash size={16} className="text-faint" />;
};

const ResultCard = ({ result }: ResultCardProps) => {
  const style = STATUS_STYLES[result.status];

  return (
    <div
      className={`flex flex-col gap-3 rounded-card border bg-surface p-5 ${style.border}`}
    >
      <div className="flex items-center gap-2">
        <StatusIcon status={result.status} />
        <span className="font-semibold text-ink">{result.name}</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${style.chip}`}
        >
          {style.label}
        </span>
      </div>

      <p className="text-sm text-muted">{result.message}</p>

      {result.status !== "not_applicable" && result.consumers.length > 0 && (
        <div className="grid grid-cols-1 gap-3 text-xs text-muted md:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-control bg-page p-3">
            <span className="font-semibold text-secondary">
              Demand — {result.consumerLabel}
            </span>
            {result.consumers.map((consumer) => (
              <span key={consumer.productUuid}>
                {consumer.quantity} × {consumer.name} ({consumer.unitValue}
                {result.unit ? ` ${result.unit}` : ""} each)
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-1 rounded-control bg-page p-3">
            <span className="font-semibold text-secondary">
              Capacity — {result.providerLabel}
            </span>
            {result.providers.length > 0 ? (
              result.providers.map((provider) => (
                <span key={provider.productUuid}>
                  {provider.quantity} × {provider.name} ({provider.unitValue}
                  {result.unit ? ` ${result.unit}` : ""} each)
                </span>
              ))
            ) : (
              <span className="text-faint">Nothing provides this.</span>
            )}
          </div>
        </div>
      )}

      {result.bins.length > 0 && (
        <div className="grid grid-cols-1 gap-3 text-xs text-muted md:grid-cols-2">
          {result.bins.map((bin) => {
            const overloaded = bin.used > bin.capacity;
            return (
              <div
                key={`${bin.productUuid}-${bin.unitIndex}`}
                className={`flex flex-col gap-1 rounded-control border p-3 ${
                  overloaded
                    ? "border-red-200 bg-red-50"
                    : "border-emerald-200 bg-emerald-50"
                }`}
              >
                <span className="font-semibold text-secondary">
                  {bin.name} #{bin.unitIndex} — {bin.used}
                  {result.unit ? ` ${result.unit}` : ""} of {bin.capacity}
                  {result.unit ? ` ${result.unit}` : ""}
                </span>
                {bin.items.length > 0 ? (
                  bin.items.map((item) => (
                    <span key={item.productUuid}>
                      {item.count} × {item.name}
                    </span>
                  ))
                ) : (
                  <span className="text-faint">Empty</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {result.bins.length > 0 && result.failingItems.length > 0 && (
        <div className="flex flex-col gap-1 rounded-control border border-red-200 bg-red-50 p-3 text-xs">
          <span className="font-semibold text-red-700">
            Did not fit anywhere
          </span>
          {result.failingItems.map((item) => (
            <span key={item.productUuid} className="text-red-700">
              {item.quantity} × {item.name}
            </span>
          ))}
        </div>
      )}

      {result.suggestions.length > 0 && (
        <div className="flex flex-col gap-1 rounded-control bg-primary-tint p-3 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-primary">
            <Lightbulb size={13} />
            Products that satisfy this demand
          </span>
          {result.suggestions.map((suggestion) => (
            <span key={suggestion.productUuid} className="text-secondary">
              {suggestion.name} — {suggestion.capacity}
              {result.unit ? ` ${result.unit}` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const Playground = ({ products, variables }: PlaygroundProps) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  // Seeded from each variable's default so the playground starts where a real
  // design would.
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        variables
          .filter((variable) => variable.defaultValue !== null)
          .map((variable) => [variable.key, String(variable.defaultValue)]),
      ),
  );
  const [report, setReport] = useState<CompatibilityReport | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const adjust = (uuid: string, delta: number) => {
    setQuantities((current) => {
      const next = Math.max(0, (current[uuid] ?? 0) + delta);
      const updated = { ...current, [uuid]: next };
      if (next === 0) {
        delete updated[uuid];
      }
      return updated;
    });
  };

  const selectionSize = Object.values(quantities).reduce(
    (sum, quantity) => sum + quantity,
    0,
  );

  const handleCheck = () => {
    startTransition(async () => {
      const result = await checkCompatibilityAction(
        Object.entries(quantities).map(([productUuid, quantity]) => ({
          productUuid,
          quantity,
        })),
        variableValues,
      );
      if (result.error || !result.report) {
        setError(result.error ?? "Failed to check compatibility");
        return;
      }
      setError(undefined);
      setReport(result.report);
    });
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-5 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">
            Build a test selection
          </h2>
          <Button
            type="button"
            onClick={handleCheck}
            disabled={isPending || selectionSize === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs"
          >
            <Play size={13} />
            {isPending ? "Checking..." : "Check compatibility"}
          </Button>
        </div>

        {variables.length > 0 && (
          <div className="flex flex-col gap-2 rounded-control border border-hairline bg-page p-3">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">
              Project answers
            </p>
            {variables.map((variable) => (
              <label
                key={variable.uuid}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-xs text-ink">
                  {variable.label}
                  {variable.unit && (
                    <span className="ml-1 text-faint">({variable.unit})</span>
                  )}
                </span>
                <input
                  type="number"
                  step="any"
                  value={variableValues[variable.key] ?? ""}
                  onChange={(event) =>
                    setVariableValues((current) => ({
                      ...current,
                      [variable.key]: event.target.value,
                    }))
                  }
                  placeholder="unanswered"
                  className="w-28 rounded-control border border-hairline bg-surface px-2 py-1 text-right text-xs text-ink outline-none focus:border-primary"
                />
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-col divide-y divide-hairline-soft">
          {products.map((product) => {
            const quantity = quantities[product.uuid] ?? 0;
            return (
              <div
                key={product.uuid}
                className="flex items-center gap-3 py-2.5"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-ink">
                    {product.name}
                  </span>
                  <span className="text-xs text-faint">
                    {product.categoryName ?? "—"}
                    {product.brandName ? ` · ${product.brandName}` : ""}
                  </span>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Remove one ${product.name}`}
                    onClick={() => adjust(product.uuid, -1)}
                    disabled={quantity === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-control border border-hairline text-secondary hover:bg-hover disabled:opacity-40"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold text-ink">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Add one ${product.name}`}
                    onClick={() => adjust(product.uuid, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-control border border-hairline text-secondary hover:bg-hover"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {products.length === 0 && (
            <p className="py-6 text-center text-sm text-faint">
              No products in the catalog yet.
            </p>
          )}
        </div>

        <FormError message={error} />
      </div>

      <div className="flex flex-col gap-3">
        {report === null ? (
          <div className="flex h-full min-h-48 items-center justify-center rounded-card border border-dashed border-hairline text-sm text-faint">
            Pick products and quantities, then run the check.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                {report.passed} passed
              </span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                {report.warnings} warnings
              </span>
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">
                {report.failures} incompatible
              </span>
              <span className="rounded-full bg-hover px-2.5 py-1 text-faint">
                {report.notApplicable} not applicable
              </span>
            </div>

            {report.results.map((result) => (
              <ResultCard key={result.ruleUuid} result={result} />
            ))}

            {report.results.length === 0 && (
              <div className="rounded-card border border-dashed border-hairline p-6 text-center text-sm text-faint">
                No enabled rules to evaluate.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
