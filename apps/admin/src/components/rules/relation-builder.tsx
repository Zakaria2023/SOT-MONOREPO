"use client";

import { useRuleForm } from "@/app/(dashboard)/rules/use-rule-form";
import { LookupEditor } from "@/components/rules/lookup-editor";
import type { RuleKind } from "@/db/enum";
import { ruleKinds } from "@/db/enum";
import {
  Braces,
  Calculator,
  Coins,
  Divide,
  Equal,
  GitCompare,
  Table2,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useWatch } from "react-hook-form";
import type {
  CompatibilityRuleListItem,
  SpecificationWithCategories,
} from "services";
import { Button, Checkbox, Dropdown, FormError, Input, Textarea } from "ui";

type RelationBuilderProps =
  | {
      mode: "add";
      specifications: SpecificationWithCategories[];
    }
  | {
      mode: "edit";
      specifications: SpecificationWithCategories[];
      rule: CompatibilityRuleListItem;
    };

type ChipProps = {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
};

type FamilyCardProps = {
  kind: RuleKind;
  active: boolean;
  onClick: () => void;
};

type FamilyMeta = {
  label: string;
  icon: LucideIcon;
  // The one-line shape of the family, shown on the card.
  shape: string;
  // The longer why, shown once the family is chosen.
  hint: string;
};

const FAMILIES: Record<RuleKind, FamilyMeta> = {
  sum_budget: {
    label: "Budget",
    icon: Coins,
    shape: "sum of demand ≤ pooled capacity",
    hint: "Sums the consumed value across every selected item (× quantity) and checks it against the pooled capacity — total camera power against a switch's PoE budget.",
  },
  count_limit: {
    label: "Count",
    icon: Calculator,
    shape: "number of items ≤ slots",
    hint: "Counts the consuming items and checks that count against the capacity — devices against switch ports. The only family allowed to mix units, since it compares a quantity against a count.",
  },
  per_item_threshold: {
    label: "Per-item",
    icon: Equal,
    shape: "each item ≤ best single provider",
    hint: "Checks each item's own value against the best single provider value — one camera's draw against the per-port maximum. Never an aggregate.",
  },
  ratio: {
    label: "Ratio",
    icon: Divide,
    shape: "demand ÷ supply ≤ target",
    hint: "Divides total demand by total supply and checks it stays within a designed contention ratio — access bandwidth ÷ uplink ≤ 20:1. A derating, so usually a soft gate.",
  },
  spec_match: {
    label: "Match",
    icon: GitCompare,
    shape: "chosen value fits the companion's",
    hint: "Compares chosen dropdown values rather than numbers — a speaker's impedance must be one the amplifier supports, two codec sets must overlap. On an attribute marked as an ordered scale, ≤ and ≥ compare position on that scale.",
  },
  conditional: {
    label: "Conditional",
    icon: Table2,
    shape: "limit looked up from a table",
    hint: "The limit isn't supplied by another product — it's read from a table keyed by the item's own other attributes. Max cable run depends on grade × speed, so the same length passes on Cat6a and fails on Cat6.",
  },
};

const Chip = ({ active, onClick, children }: ChipProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={
      active
        ? "rounded-control bg-primary px-3 py-2 text-xs font-semibold text-white"
        : "rounded-control border border-hairline bg-page px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-primary hover:text-primary"
    }
  >
    {children}
  </button>
);

const FamilyCard = ({ kind, active, onClick }: FamilyCardProps) => {
  const meta = FAMILIES[kind];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "flex flex-col items-start gap-1 rounded-control border-2 border-primary bg-primary-tint p-3 text-left"
          : "flex flex-col items-start gap-1 rounded-control border border-hairline bg-page p-3 text-left transition-colors hover:border-primary/50"
      }
    >
      <span
        className={
          active
            ? "flex items-center gap-1.5 text-sm font-semibold text-primary"
            : "flex items-center gap-1.5 text-sm font-semibold text-ink"
        }
      >
        <Icon size={15} />
        {meta.label}
      </span>
      <span className="text-[11px] leading-snug text-muted">{meta.shape}</span>
    </button>
  );
};

export const RelationBuilder = (props: RelationBuilderProps) => {
  const { mode, specifications } = props;

  const { form, state, isPending, onSubmit } = useRuleForm(
    mode === "edit" ? { mode: "edit", rule: props.rule } : { mode: "add" },
  );
  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = form;

  const [showJson, setShowJson] = useState(false);

  const kind = useWatch({ control, name: "kind" });
  const comparator = useWatch({ control, name: "comparator" });
  const severity = useWatch({ control, name: "severity" });
  const allocation = useWatch({ control, name: "allocation" });
  const headroomPercent = useWatch({ control, name: "headroomPercent" });
  const ratioLimit = useWatch({ control, name: "ratioLimit" });
  const conditionSpecKey = useWatch({ control, name: "conditionSpecKey" });
  const conditionValue = useWatch({ control, name: "conditionValue" });
  const consumerSpecUuid = useWatch({ control, name: "consumerSpecUuid" });
  const providerSpecUuid = useWatch({ control, name: "providerSpecUuid" });
  const lookupRows = useWatch({ control, name: "lookupRows" }) ?? [];
  const lookupInputs = useWatch({ control, name: "lookupInputs" }) ?? [];

  const isRatio = kind === "ratio";
  const isSpecMatch = kind === "spec_match";
  const isConditional = kind === "conditional";

  // Per-device distribution only applies to aggregating rules with "fit
  // within" — not per-item, ratio, match or conditional.
  const allocationApplies =
    !isRatio &&
    !isSpecMatch &&
    !isConditional &&
    kind !== "per_item_threshold" &&
    comparator === "lte";

  const showHeadroom = !isRatio && !isSpecMatch;

  const numericSpecs = useMemo(
    () =>
      specifications.filter(
        (specification) => specification.valueType === "number",
      ),
    [specifications],
  );

  // The engine reads conditions and lookup keys by spec KEY, so specs sharing
  // one key are one logical field — merge them, combining option values.
  const selectSpecs = useMemo(() => {
    const byKey = new Map<
      string,
      (typeof specifications)[number] & { categoryNames: string[] }
    >();
    for (const specification of specifications) {
      if (specification.valueType !== "select") {
        continue;
      }
      const existing = byKey.get(specification.key);
      if (!existing) {
        byKey.set(specification.key, { ...specification });
        continue;
      }
      existing.categoryNames = [
        ...new Set([...existing.categoryNames, ...specification.categoryNames]),
      ];
      const knownValues = new Set(
        (existing.options ?? []).map((option) => option.value),
      );
      existing.options = [
        ...(existing.options ?? []),
        ...(specification.options ?? []).filter(
          (option) => !knownValues.has(option.value),
        ),
      ];
    }
    return [...byKey.values()];
  }, [specifications]);

  const conditionSpec = selectSpecs.find(
    (specification) => specification.key === conditionSpecKey,
  );

  const specOption = (specification: SpecificationWithCategories) => {
    const name = specification.unit
      ? `${specification.label} (${specification.unit})`
      : specification.label;
    const categories =
      specification.categoryNames.length > 0
        ? ` — ${specification.categoryNames.join(", ")}`
        : "";
    return { value: specification.uuid, label: `${name}${categories}` };
  };

  // Match binds dropdown specs; every other family binds numeric specs.
  const operandOptions = (
    isSpecMatch
      ? specifications.filter(
          (specification) => specification.valueType === "select",
        )
      : numericSpecs
  ).map(specOption);

  const lookupInputOptions = selectSpecs.map((specification) => ({
    value: specification.key,
    label: specification.label,
  }));

  const lookupValuesByKey = Object.fromEntries(
    selectSpecs.map((specification) => [
      specification.key,
      (specification.options ?? []).map((option) => option.value),
    ]),
  );

  // Unit/label of whichever operand each side currently holds — drives both
  // the badges in the sentence and the mismatch warning.
  const consumerUnit = numericSpecs.find(
    (specification) => specification.uuid === consumerSpecUuid,
  )?.unit;
  const providerUnit = numericSpecs.find(
    (specification) => specification.uuid === providerSpecUuid,
  )?.unit;

  const unitsMismatch =
    !isRatio &&
    !isSpecMatch &&
    !isConditional &&
    kind !== "count_limit" &&
    Boolean(consumerSpecUuid) &&
    Boolean(providerSpecUuid) &&
    consumerUnit !== providerUnit;

  const pickedSpecsOrdered = [consumerSpecUuid, providerSpecUuid].some((uuid) =>
    specifications.some(
      (specification) => specification.uuid === uuid && specification.ordered,
    ),
  );
  const scaleWithoutOrder =
    isSpecMatch &&
    (comparator === "lte" || comparator === "gte") &&
    Boolean(consumerSpecUuid) &&
    Boolean(providerSpecUuid) &&
    !pickedSpecsOrdered;

  const comparatorChips = isSpecMatch
    ? [
        { value: "in", label: "is one of  ∈" },
        { value: "intersects", label: "overlaps  ∩" },
        { value: "eq", label: "equals  =" },
        { value: "lte", label: "at most, on scale  ≤" },
        { value: "gte", label: "at least, on scale  ≥" },
      ]
    : [
        { value: "lte", label: "fits within  ≤" },
        { value: "gte", label: "is at least  ≥" },
        { value: "eq", label: "equals  =" },
      ];

  // The Relationship object as it will be stored — the same four-object
  // contract the storefront, engine and retrieval layer all read.
  const relationJson = {
    family: kind,
    gate: severity === "block" ? "hard" : "soft",
    operands: {
      demand: consumerSpecUuid ? { type: "spec", id: consumerSpecUuid } : null,
      supply: isConditional
        ? { type: "lookup" }
        : providerSpecUuid
          ? { type: "spec", id: providerSpecUuid }
          : null,
    },
    operator: isRatio ? "ratio" : comparator,
    ...(showHeadroom ? { headroom: headroomPercent } : {}),
    ...(isRatio ? { ratio: ratioLimit } : {}),
    ...(allocationApplies ? { allocation } : {}),
    ...(isConditional ? { lookup: { inputs: lookupInputs, rows: lookupRows } } : {}),
    ...(conditionSpecKey && conditionValue
      ? { condition: { specKey: conditionSpecKey, values: [conditionValue] } }
      : {}),
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-6 rounded-card border border-hairline bg-surface p-7 shadow-[0_1px_2px_rgba(27,35,51,0.04)]"
    >
      <div className="flex items-center gap-3 border-b border-hairline pb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-tint text-primary">
          <GitCompare size={20} />
        </div>
        <div>
          <h2 className="font-heading text-xl text-ink">
            {mode === "edit" ? "Edit relation" : "Create relation"}
          </h2>
          <p className="text-xs text-muted">
            A relation binds two attributes, never two categories — any product
            carrying them takes part, whatever tree it lives in.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Name"
          placeholder="e.g. PoE power budget"
          {...register("name")}
          error={errors.name?.message}
        />
        <Textarea
          label="Description"
          placeholder="What this relation protects against (optional)"
          rows={1}
          {...register("description")}
        />
      </div>

      {/* Family — the shape of the check, chosen first because everything
          below it changes with the answer. */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-ink">Family</label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {ruleKinds.map((value) => (
            <FamilyCard
              key={value}
              kind={value}
              active={kind === value}
              onClick={() => setValue("kind", value, { shouldDirty: true })}
            />
          ))}
        </div>
        <p className="text-xs text-muted">{FAMILIES[kind].hint}</p>
      </div>

      {/* Gate */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-ink">Gate</span>
        <div className="flex items-center gap-2">
          <Chip
            active={severity === "block"}
            onClick={() => setValue("severity", "block", { shouldDirty: true })}
          >
            Hard — blocks the selection
          </Chip>
          <Chip
            active={severity === "warn"}
            onClick={() => setValue("severity", "warn", { shouldDirty: true })}
          >
            Soft — warns but allows
          </Chip>
        </div>
      </div>

      {/* The relation itself, read as a sentence. */}
      <div className="flex flex-col gap-4 rounded-control border border-hairline bg-page p-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">
            {isSpecMatch ? "Device attribute" : "Demand"}
          </span>
          <Dropdown
            searchable
            value={consumerSpecUuid}
            onChange={(value) =>
              setValue("consumerSpecUuid", value, { shouldDirty: true })
            }
            placeholder={
              isSpecMatch ? "e.g. Speaker Impedance" : "e.g. Power Consumption"
            }
            searchPlaceholder="Search attributes…"
            options={operandOptions}
          />
          <FormError message={errors.consumerSpecUuid?.message} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isRatio ? (
            <span className="rounded-control bg-primary px-3 py-2 text-xs font-semibold text-white">
              ÷ supply ≤
            </span>
          ) : (
            comparatorChips.map((option) => (
              <Chip
                key={option.value}
                active={comparator === option.value}
                onClick={() =>
                  setValue(
                    "comparator",
                    option.value as typeof comparator,
                    { shouldDirty: true },
                  )
                }
              >
                {option.label}
              </Chip>
            ))
          )}

          {showHeadroom && (
            <span className="flex items-center gap-1.5 rounded-control border border-hairline bg-surface px-2 py-1 text-xs text-muted">
              <input
                type="number"
                min={1}
                max={100}
                {...register("headroomPercent", { valueAsNumber: true })}
                className="w-14 bg-transparent text-right text-ink outline-none"
              />
              % of
            </span>
          )}

          {isRatio && (
            <span className="flex items-center gap-1.5 rounded-control border border-hairline bg-surface px-2 py-1 text-xs text-muted">
              <input
                type="number"
                min={1}
                step="any"
                {...register("ratioLimit", { valueAsNumber: true })}
                className="w-14 bg-transparent text-right text-ink outline-none"
              />
              : 1
            </span>
          )}
        </div>
        <FormError message={errors.headroomPercent?.message} />
        <FormError message={errors.ratioLimit?.message} />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">
            {isConditional
              ? "Limit"
              : isSpecMatch
                ? "Companion attribute"
                : "Supply"}
          </span>
          {isConditional ? (
            <p className="rounded-control border border-dashed border-hairline bg-surface px-3 py-2 text-xs text-muted">
              Read from the lookup table below — a conditional relation has no
              product on this side.
            </p>
          ) : (
            <Dropdown
              searchable
              value={providerSpecUuid}
              onChange={(value) =>
                setValue("providerSpecUuid", value, { shouldDirty: true })
              }
              placeholder={
                isSpecMatch ? "e.g. Supported Impedance" : "e.g. PoE Budget"
              }
              searchPlaceholder="Search attributes…"
              options={operandOptions}
            />
          )}
          <FormError message={errors.providerSpecUuid?.message} />
        </div>

        {allocationApplies && (
          <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
            <span className="text-xs text-muted">Capacity is</span>
            <Chip
              active={allocation === "pooled"}
              onClick={() =>
                setValue("allocation", "pooled", { shouldDirty: true })
              }
            >
              one shared pool
            </Chip>
            <Chip
              active={allocation === "per_provider"}
              onClick={() =>
                setValue("allocation", "per_provider", { shouldDirty: true })
              }
            >
              per device
            </Chip>
            <span className="text-xs text-faint">
              Two 300 W switches are two 300 W bins, not one 600 W pool.
            </span>
          </div>
        )}
      </div>

      {isConditional && (
        <>
          <LookupEditor
            inputs={lookupInputs}
            rows={lookupRows}
            inputOptions={lookupInputOptions}
            valuesByKey={lookupValuesByKey}
            limitUnit={consumerUnit}
            onChange={(inputs, rows) => {
              setValue("lookupInputs", inputs, { shouldDirty: true });
              setValue("lookupRows", rows, { shouldDirty: true });
            }}
          />
          <FormError message={errors.lookupRows?.message} />
        </>
      )}

      {unitsMismatch && (
        <p className="flex items-start gap-2 rounded-control border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <span>
            These two sides use different units ({consumerUnit ?? "no unit"} vs{" "}
            {providerUnit ?? "no unit"}). Budget and per-item relations compare
            values directly, so both must share one unit — only Count may mix
            them (devices against ports).
          </span>
        </p>
      )}

      {scaleWithoutOrder && (
        <p className="flex items-start gap-2 rounded-control border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <span>
            Neither attribute is marked as an ordered scale, so &ldquo;at
            most&rdquo; has no meaning here and the engine falls back to plain
            membership. Turn on &ldquo;ordered scale&rdquo; in the{" "}
            <Link href="/library" className="font-semibold underline">
              specification library
            </Link>{" "}
            if its options run low-to-high (802.3af → at → bt).
          </span>
        </p>
      )}

      {/* Condition — narrows who takes part on the demand side. */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-ink">
          Only counts when{" "}
          <span className="font-normal text-muted">(optional)</span>
        </label>
        <p className="text-xs text-muted">
          Narrows which items take part — e.g. only devices with PoE = Yes draw
          from the PoE budget.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Dropdown
            searchable
            value={conditionSpecKey}
            onChange={(value) => {
              setValue("conditionSpecKey", value, { shouldDirty: true });
              setValue("conditionValue", "", { shouldDirty: true });
            }}
            placeholder="No condition"
            options={[
              { value: "", label: "No condition" },
              ...selectSpecs.map((specification) => ({
                value: specification.key,
                label: specification.label,
              })),
            ]}
          />
          {conditionSpec && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">is</span>
              {(conditionSpec.options ?? []).map((option) => (
                <Chip
                  key={option.value}
                  active={conditionValue === option.value}
                  onClick={() =>
                    setValue("conditionValue", option.value, {
                      shouldDirty: true,
                    })
                  }
                >
                  {option.value}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-hairline pt-5">
        <button
          type="button"
          onClick={() => setShowJson(!showJson)}
          className="flex w-fit items-center gap-1.5 text-xs font-semibold text-primary"
        >
          <Braces size={14} />
          {showJson ? "Hide" : "Show"} stored shape
        </button>
        {showJson && (
          <pre className="overflow-x-auto rounded-control border border-hairline bg-page p-3 text-[11px] leading-relaxed text-muted">
            {JSON.stringify(relationJson, null, 2)}
          </pre>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-hairline pt-5">
        <Checkbox label="Relation enabled" {...register("enabled")} />
        <div className="flex items-center gap-3">
          <Link
            href="/rules"
            className="text-sm text-secondary hover:underline"
          >
            Cancel
          </Link>
          <Button type="submit" disabled={isPending}>
            {mode === "edit"
              ? isPending
                ? "Saving…"
                : "Save relation"
              : isPending
                ? "Creating…"
                : "Create relation"}
          </Button>
        </div>
      </div>

      <FormError message={state.error} />
    </form>
  );
};
