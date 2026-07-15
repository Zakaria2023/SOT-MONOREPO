"use client";

import { useRuleForm } from "@/app/(dashboard)/rules/use-rule-form";
import type { RuleKind } from "@/db/enum";
import { ruleKinds } from "@/db/enum";
import { RULE_KIND_LABELS } from "@/db/label";
import { GitCompare } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Controller, useWatch } from "react-hook-form";
import type {
  CompatibilityRuleListItem,
  SpecificationWithCategories,
} from "services";
import { Button, Checkbox, Dropdown, FormError, Input, Textarea } from "ui";

type RuleFormProps =
  | {
      mode: "add";
      specifications: SpecificationWithCategories[];
    }
  | {
      mode: "edit";
      specifications: SpecificationWithCategories[];
      rule: CompatibilityRuleListItem;
    };

const KIND_HINTS: Record<RuleKind, string> = {
  sum_budget:
    "Sums the consumed spec across every selected item (× quantity) and checks it against the pooled capacity — e.g. total camera power vs switch PoE budget.",
  count_limit:
    "Counts the consuming items (quantities) and checks the count against the pooled capacity — e.g. number of devices vs switch port count.",
  per_item_threshold:
    "Checks each item's own value against the best provider value — e.g. one camera's draw vs the per-port maximum.",
};

export const RuleForm = (props: RuleFormProps) => {
  const { mode, specifications } = props;

  const { form, state, isPending, onSubmit } = useRuleForm(
    mode === "edit" ? { mode: "edit", rule: props.rule } : { mode: "add" },
  );
  const {
    register,
    control,
    formState: { errors },
  } = form;

  const kind = useWatch({ control, name: "kind" });
  const conditionSpecKey = useWatch({ control, name: "conditionSpecKey" });
  const consumerSpecUuid = useWatch({ control, name: "consumerSpecUuid" });
  const providerSpecUuid = useWatch({ control, name: "providerSpecUuid" });

  // Rules aggregate numbers — only numeric specs can be bound.
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
    kind !== "count_limit" &&
    Boolean(consumerSpecUuid) &&
    Boolean(providerSpecUuid) &&
    consumerUnit !== providerUnit;

  // Show each spec's categories so it's obvious rules span category trees —
  // a Switching spec on one side, an IP Camera spec on the other is normal.
  const numericOptions = numericSpecs.map((specification) => {
    const name = specification.unit
      ? `${specification.label} (${specification.unit})`
      : specification.label;
    const categories =
      specification.categoryNames.length > 0
        ? ` — ${specification.categoryNames.join(", ")}`
        : "";
    return { value: specification.uuid, label: `${name}${categories}` };
  });

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

        <Input
          label="Usable capacity (%)"
          type="number"
          min={1}
          max={100}
          {...register("headroomPercent", { valueAsNumber: true })}
          error={errors.headroomPercent?.message}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink">
            Consumed specification
          </label>
          <Controller
            control={control}
            name="consumerSpecUuid"
            render={({ field }) => (
              <Dropdown
                value={field.value}
                onChange={field.onChange}
                placeholder="e.g. Power Consumption"
                options={numericOptions}
              />
            )}
          />
          <FormError message={errors.consumerSpecUuid?.message} />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink">Comparison</label>
          <Controller
            control={control}
            name="comparator"
            render={({ field }) => (
              <Dropdown
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "lte", label: "must fit within (≤)" },
                  { value: "gte", label: "must be at least (≥)" },
                  { value: "eq", label: "must equal (=)" },
                ]}
              />
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink">
            Capacity specification
          </label>
          <Controller
            control={control}
            name="providerSpecUuid"
            render={({ field }) => (
              <Dropdown
                value={field.value}
                onChange={field.onChange}
                placeholder="e.g. PoE Budget"
                options={numericOptions}
              />
            )}
          />
          <FormError message={errors.providerSpecUuid?.message} />
        </div>
      </div>

      {unitsMismatch && (
        <p className="rounded-control border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          These two specifications use different units (
          {consumerUnit ?? "no unit"} vs {providerUnit ?? "no unit"}). Sum and
          per-item rules compare values directly, so both sides must share one
          unit — only count rules may mix units (devices vs ports).
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
