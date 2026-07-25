"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { createRuleAction, updateRuleAction } from "./actions";
import type { RuleActionInput, RuleActionResult } from "./actions";
import { ruleFormSchema } from "./validation";
import type { RuleFormValues } from "./validation";
import type { CompatibilityRuleListItem } from "services";

type UseRuleFormArgs =
  | { mode: "add" }
  | { mode: "edit"; rule: CompatibilityRuleListItem };

export const useRuleForm = (args: UseRuleFormArgs) => {
  const action =
    args.mode === "edit"
      ? (prevState: RuleActionResult, input: RuleActionInput) =>
          updateRuleAction(args.rule.uuid, prevState, input)
      : createRuleAction;

  const [state, dispatch, isPending] = useActionState(action, {});

  const rule = args.mode === "edit" ? args.rule : undefined;

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      name: rule?.name ?? "",
      description: rule?.description ?? "",
      kind: rule?.kind ?? "sum_budget",
      consumerSpecUuid: rule?.consumerSpecUuid ?? "",
      providerSpecUuid: rule?.providerSpecUuid ?? "",
      consumerVariableUuid: rule?.consumerVariableUuid ?? "",
      providerVariableUuid: rule?.providerVariableUuid ?? "",
      lookupInputs: rule?.lookup?.inputs ?? [],
      lookupRows: rule?.lookup?.rows ?? [],
      comparator: rule?.comparator ?? "lte",
      allocation: rule?.allocation ?? "pooled",
      headroomPercent: rule?.headroomPercent ?? 100,
      ratioLimit: rule?.ratioLimit ? Number(rule.ratioLimit) : 20,
      conditionSpecKey: rule?.condition?.specKey ?? "",
      conditionValue: rule?.condition?.values[0] ?? "",
      severity: rule?.severity ?? "block",
      enabled: rule?.enabled ?? true,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch(values);
    });
  });

  return { form, state, isPending, onSubmit };
};
