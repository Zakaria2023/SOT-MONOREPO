"use client";

import { useRuleForm } from "@/app/(dashboard)/rules/use-rule-form";
import type { RuleKind } from "@/db/enum";
import { ruleKinds } from "@/db/enum";
import { RULE_KIND_LABELS } from "@/db/label";
import { LookupEditor } from "@/components/rules/lookup-editor";
import { GitCompare } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Controller, useWatch } from "react-hook-form";
import type {
  CompatibilityRuleListItem,
  ProjectVariableListItem,
  SpecificationWithCategories,
} from "services";
import { Button, Checkbox, Dropdown, FormError, Input, Textarea } from "ui";

type RuleFormProps =
  | {
      mode: "add";
      specifications: SpecificationWithCategories[];
      variables: ProjectVariableListItem[];
    }
  | {
      mode: "edit";
      specifications: SpecificationWithCategories[];
      variables: ProjectVariableListItem[];
      rule: CompatibilityRuleListItem;
    };

const KIND_HINTS: Record<RuleKind, string> = {
  sum_budget:
    "Sums the consumed spec across every selected item (× quantity) and checks it against the pooled capacity — e.g. total camera power vs switch PoE budget.",
  count_limit:
    "Counts the consuming items (quantities) and checks the count against the pooled capacity — e.g. number of devices vs switch port count.",
  per_item_threshold:
    "Checks each item's own value against the best provider value — e.g. one camera's draw vs the per-port maximum.",
  ratio:
    "Divides total demand by total supply and checks it stays within a target contention ratio — e.g. access bandwidth ÷ uplink ≤ 20:1. A designed derating, usually a warning.",
  spec_match:
    "Checks each item's chosen dropdown value against the companion's — e.g. a speaker's impedance must be one the amplifier supports, or two codec sets must overlap. Uses dropdown (select) specs, not numbers. On an attribute marked as an ordered scale in the library, ≤ and ≥ compare position on that scale, so an 802.3af device fits an 802.3at switch.",
  conditional:
    "Reads the limit from a table keyed by the item's OWN other attributes, then checks the item against it — e.g. max cable run depends on grade × speed, so Cat6 at 10G allows 55 m while Cat6a at 10G allows 100 m. There is no capacity product on the other side: the table is the capacity.",
};

// A side of a rule is one operand — a spec or a project variable. The dropdown
// carries both in one list, prefixed so the two form fields can be recovered.
const SPEC_PREFIX = "spec:";
const VARIABLE_PREFIX = "var:";

const operandValue = (specUuid: string, variableUuid: string): string => {
  if (specUuid) {
    return `${SPEC_PREFIX}${specUuid}`;
  }
  if (variableUuid) {
    return `${VARIABLE_PREFIX}${variableUuid}`;
  }
  return "";
};

export const RuleForm = (props: RuleFormProps) => {
  const { mode, specifications, variables } = props;

  const { form, state, isPending, onSubmit } = useRuleForm(
    mode === "edit" ? { mode: "edit", rule: props.rule } : { mode: "add" },
  );
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;

  const kind = useWatch({ control, name: "kind" });
  const comparator = useWatch({ control, name: "comparator" });
  const conditionSpecKey = useWatch({ control, name: "conditionSpecKey" });
  const consumerSpecUuid = useWatch({ control, name: "consumerSpecUuid" });
  const providerSpecUuid = useWatch({ control, name: "providerSpecUuid" });
  const consumerVariableUuid = useWatch({
    control,
    name: "consumerVariableUuid",
  });
  const providerVariableUuid = useWatch({
    control,
    name: "providerVariableUuid",
  });
  const lookupRows = useWatch({ control, name: "lookupRows" }) ?? [];
  const lookupInputs = useWatch({ control, name: "lookupInputs" }) ?? [];

  const isRatio = kind === "ratio";
  const isSpecMatch = kind === "spec_match";
  const isConditional = kind === "conditional";

  // Writing one side clears the other operand field, so a rule can never end
  // up bound to a spec and a variable at once.
  const setOperand = (side: "consumer" | "provider", value: string) => {
    const specField = side === "consumer" ? "consumerSpecUuid" : "providerSpecUuid";
    const variableField =
      side === "consumer" ? "consumerVariableUuid" : "providerVariableUuid";
    setValue(specField, value.startsWith(SPEC_PREFIX) ? value.slice(SPEC_PREFIX.length) : "", { shouldDirty: true });
    setValue(
      variableField,
      value.startsWith(VARIABLE_PREFIX)
        ? value.slice(VARIABLE_PREFIX.length)
        : "",
      { shouldDirty: true },
    );
  };

  // Per-device distribution only applies to aggregating sum/count rules with
  // "fit within" — not per-item, ratio, or spec_match.
  const allocationApplies =
    !isRatio &&
    !isSpecMatch &&
    kind !== "per_item_threshold" &&
    comparator === "lte";

  // Headroom % applies to the aggregating/threshold kinds; ratio uses a target
  // ratio instead, and spec_match has no numeric knob.
  const showHeadroom = !isRatio && !isSpecMatch;

  // Numeric rules bind number specs; spec_match binds dropdown (select) specs.
  const numericSpecs = useMemo(
    () =>
      specifications.filter(
        (specification) => specification.valueType === "number",
      ),
    [specifications],
  );

  // Conditions filter on chosen dropdown values. The engine reads conditions
  // by spec KEY, so several specs sharing one key (e.g. two "POE" specs on
  // different categories) are one logical field — merge them into a single
  // option, combining their categories and option values.
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

  // Sum and per-item rules compare values directly, so both sides must share
  // one unit; count rules compare a quantity against a count-like capacity
  // and are exempt. The service enforces this too — this is the early hint.
  const consumerUnit = numericSpecs.find(
    (specification) => specification.uuid === consumerSpecUuid,
  )?.unit;
  const providerUnit = numericSpecs.find(
    (specification) => specification.uuid === providerSpecUuid,
  )?.unit;
  const unitsMismatch =
    !isRatio &&
    !isSpecMatch &&
    kind !== "count_limit" &&
    Boolean(consumerSpecUuid) &&
    Boolean(providerSpecUuid) &&
    consumerUnit !== providerUnit;

  // Show each spec's categories so it's obvious rules span category trees —
  // a Switching spec on one side, an IP Camera spec on the other is normal.
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

  const numericOptions = numericSpecs.map(specOption);
  const selectOptions = specifications
    .filter((specification) => specification.valueType === "select")
    .map(specOption);
  // spec_match binds dropdown specs; every other kind binds numeric specs.
  const specOptions = (isSpecMatch ? selectOptions : numericOptions).map(
    (option) => ({ ...option, value: `${SPEC_PREFIX}${option.value}` }),
  );

  // Project variables are numeric answers to a design question, so they only
  // stand in where a number is expected — never on a spec_match rule.
  const variableOptions = isSpecMatch
    ? []
    : variables.map((variable) => ({
        value: `${VARIABLE_PREFIX}${variable.uuid}`,
        label: variable.unit
          ? `${variable.label} (${variable.unit}) — project variable`
          : `${variable.label} — project variable`,
      }));

  const consumerProviderOptions = [...specOptions, ...variableOptions];

  // The attributes a conditional rule's table can be keyed by: any dropdown
  // spec, since the table matches an item's own chosen values.
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

  const comparatorOptions = isSpecMatch
    ? [
        { value: "in", label: "must be one of (∈)" },
        { value: "intersects", label: "must overlap (∩)" },
        { value: "eq", label: "must equal (=)" },
        { value: "lte", label: "must be at most, on the scale (≤)" },
        { value: "gte", label: "must be at least, on the scale (≥)" },
      ]
    : [
        { value: "lte", label: "must fit within (≤)" },
        { value: "gte", label: "must be at least (≥)" },
        { value: "eq", label: "must equal (=)" },
      ];

  // A scale comparison on dropdown specs needs at least one side marked as an
  // ordered scale in the library — otherwise there is no "at most" to read and
  // the engine falls back to plain membership. Warn rather than block, since
  // the author may be about to mark it ordered.
  const scaleComparator =
    isSpecMatch && (comparator === "lte" || comparator === "gte");
  const pickedSpecsOrdered = [consumerSpecUuid, providerSpecUuid].some((uuid) =>
    specifications.some(
      (specification) => specification.uuid === uuid && specification.ordered,
    ),
  );
  const scaleWithoutOrder =
    scaleComparator &&
    Boolean(consumerSpecUuid) &&
    Boolean(providerSpecUuid) &&
    !pickedSpecsOrdered;

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-6 rounded-card border border-hairline bg-surface p-7 shadow-[0_1px_2px_rgba(27,35,51,0.04)]"
    >
      <div className="flex items-center gap-3 border-b border-hairline pb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-tint text-primary">
          <GitCompare size={20} />
        </div>
        <h2 className="font-heading text-xl text-ink">
          {mode === "edit" ? "Edit rule" : "Create rule"}
        </h2>
      </div>

      {/* <p className="rounded-control bg-primary-tint p-4 text-xs text-secondary">
        Rules are global: they bind specifications, never categories. The two
        specifications may come from completely different category trees — e.g.
        Power Consumption lives on IP Cameras (Security tree) while PoE Budget
        lives on Switches (Networking tree). Any product carrying the spec
        participates, whatever its category.
      </p>

      {numericSpecs.length < 2 && (
        <p className="rounded-control border border-dashed border-hairline p-4 text-sm text-faint">
          Rules bind two numeric specifications (a consumed one and a capacity
          one). Create numeric specifications first — e.g. &quot;Power
          Consumption (W)&quot; and &quot;PoE Budget (W)&quot;.
        </p>
      )} */}

      <Input
        label="Name"
        placeholder="e.g. PoE power budget"
        {...register("name")}
        error={errors.name?.message}
      />

      <Textarea
        label="Description"
        placeholder="What this rule protects against (optional)"
        rows={2}
        {...register("description")}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink">Rule type</label>
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <Dropdown
                value={field.value}
                onChange={field.onChange}
                options={ruleKinds.map((value) => ({
                  value,
                  label: RULE_KIND_LABELS[value],
                }))}
              />
            )}
          />
          <p className="text-xs text-muted">{KIND_HINTS[kind]}</p>
        </div>

        {showHeadroom && (
          <Input
            label="Usable capacity (%)"
            type="number"
            min={1}
            max={100}
            {...register("headroomPercent", { valueAsNumber: true })}
            error={errors.headroomPercent?.message}
          />
        )}
        {isRatio && (
          <Input
            label="Target ratio (N : 1)"
            type="number"
            min={1}
            step="any"
            placeholder="e.g. 20"
            {...register("ratioLimit", { valueAsNumber: true })}
            error={errors.ratioLimit?.message}
          />
        )}
      </div>

      {allocationApplies && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-ink">
              Capacity sharing
            </label>
            <Controller
              control={control}
              name="allocation"
              render={({ field }) => (
                <Dropdown
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    {
                      value: "pooled",
                      label: "Shared pool — all providers together",
                    },
                    {
                      value: "per_provider",
                      label: "Per device — each provider unit checked alone",
                    },
                  ]}
                />
              )}
            />
            <p className="text-xs text-muted">
              Shared pool adds all capacities into one total. Per device
              distributes the items across the individual units (two 300 W
              switches are two separate 300 W bins, not one 600 W pool) and
              every unit must fit its share.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink">
            {isSpecMatch
              ? "Device specification"
              : isRatio
                ? "Demand specification"
                : "Consumed specification"}
          </label>
          <Dropdown
            searchable
            value={operandValue(consumerSpecUuid, consumerVariableUuid)}
            onChange={(value) => setOperand("consumer", value)}
            placeholder={
              isSpecMatch ? "e.g. Speaker Impedance" : "e.g. Power Consumption"
            }
            options={consumerProviderOptions}
          />
          <FormError message={errors.consumerSpecUuid?.message} />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink">Comparison</label>
          {isRatio ? (
            <div className="flex h-10 items-center justify-center rounded-control border border-hairline bg-page text-sm text-muted">
              demand ÷ supply ≤ ratio
            </div>
          ) : (
            <Controller
              control={control}
              name="comparator"
              render={({ field }) => (
                <Dropdown
                  value={field.value}
                  onChange={field.onChange}
                  options={comparatorOptions}
                />
              )}
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink">
            {isConditional
              ? "Capacity"
              : isSpecMatch
                ? "Companion specification"
                : isRatio
                  ? "Supply specification"
                  : "Capacity specification"}
          </label>
          {isConditional ? (
            <div className="flex h-10 items-center justify-center rounded-control border border-dashed border-hairline bg-page px-3 text-center text-xs text-muted">
              the lookup table below
            </div>
          ) : (
            <Dropdown
              searchable
              value={operandValue(providerSpecUuid, providerVariableUuid)}
              onChange={(value) => setOperand("provider", value)}
              placeholder={
                isSpecMatch ? "e.g. Supported Impedance" : "e.g. PoE Budget"
              }
              options={consumerProviderOptions}
            />
          )}
          <FormError message={errors.providerSpecUuid?.message} />
        </div>
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
        <p className="rounded-control border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          These two specifications use different units (
          {consumerUnit ?? "no unit"} vs {providerUnit ?? "no unit"}). Sum and
          per-item rules compare values directly, so both sides must share one
          unit — only count rules may mix units (devices vs ports).
        </p>
      )}

      {scaleWithoutOrder && (
        <p className="rounded-control border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          Neither of these attributes is marked as an ordered scale, so
          &ldquo;at most&rdquo; has no meaning here and the engine will fall
          back to plain membership. Open the attribute in the{" "}
          <Link href="/library" className="font-semibold underline">
            specification library
          </Link>{" "}
          and turn on &ldquo;ordered scale&rdquo; if its options run
          low-to-high (802.3af → at → bt, 100M → 1G → 10G).
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-hairline pt-6">
        <div>
          <label className="text-sm font-semibold text-ink">
            Condition (optional)
          </label>
          <p className="mt-1 text-xs text-muted">
            Only count items whose chosen value matches — e.g. only devices with
            PoE = Yes draw from the PoE budget.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Controller
            control={control}
            name="conditionSpecKey"
            render={({ field }) => (
              <Dropdown
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  form.setValue("conditionValue", "");
                }}
                placeholder="No condition"
                options={[
                  { value: "", label: "No condition" },
                  ...selectSpecs.map((specification) => ({
                    value: specification.key,
                    label:
                      specification.categoryNames.length > 0
                        ? `${specification.label} — ${specification.categoryNames.join(", ")}`
                        : specification.label,
                  })),
                ]}
              />
            )}
          />

          {conditionSpec && (
            <Controller
              control={control}
              name="conditionValue"
              render={({ field }) => (
                <Dropdown
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Pick the required value"
                  options={(conditionSpec.options ?? []).map((option) => ({
                    value: option.value,
                    label: option.value,
                  }))}
                />
              )}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-hairline pt-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink">On violation</label>
          <Controller
            control={control}
            name="severity"
            render={({ field }) => (
              <Dropdown
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "block", label: "Block — incompatible selection" },
                  { value: "warn", label: "Warn — flag but allow" },
                ]}
              />
            )}
          />
        </div>

        <div className="flex items-end pb-2">
          <Checkbox label="Rule enabled" {...register("enabled")} />
        </div>
      </div>

      <FormError message={state.error} />

      <div className="flex items-center gap-3 border-t border-hairline pt-5">
        <Button type="submit" disabled={isPending}>
          {mode === "edit"
            ? isPending
              ? "Saving..."
              : "Save Changes"
            : isPending
              ? "Creating..."
              : "Create Rule"}
        </Button>
        <Link href="/rules" className="text-sm text-secondary hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
};
