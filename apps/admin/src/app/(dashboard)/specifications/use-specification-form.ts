"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { slugify } from "utils";
import {
  createSpecificationAction,
  updateSpecificationAction,
} from "./action";
import type {
  SpecificationActionInput,
  SpecificationActionResult,
} from "./action";
import { specificationFormSchema } from "./validation";
import type {
  SpecFieldForm,
  SpecificationFormValues,
  SpecOptionForm,
} from "./validation";
import type { SpecField, SpecOption } from "@/db/types";
import type { SpecificationWithCategories } from "services";

type UseSpecificationFormArgs =
  | { mode: "add" }
  | { mode: "edit"; specification: SpecificationWithCategories };

// Form tree -> stored tree, deriving a stable key from each label.
const toSpecFields = (fields: SpecFieldForm[]): SpecField[] =>
  fields.map((field) => ({
    key: slugify(field.label),
    label: field.label,
    options: toSpecOptions(field.options),
  }));

const toSpecOptions = (options: SpecOptionForm[]): SpecOption[] =>
  options.map((option) => ({
    value: option.value,
    children: toSpecFields(option.children),
  }));

// Stored tree -> editable form tree (labels only, keys dropped).
const toFormFields = (fields: SpecField[]): SpecFieldForm[] =>
  fields.map((field) => ({
    label: field.label,
    options: toFormOptions(field.options),
  }));

const toFormOptions = (options: SpecOption[]): SpecOptionForm[] =>
  options.map((option) => ({
    value: option.value,
    children: toFormFields(option.children),
  }));

export const useSpecificationForm = (args: UseSpecificationFormArgs) => {
  const action =
    args.mode === "edit"
      ? (
          prevState: SpecificationActionResult,
          input: SpecificationActionInput,
        ) =>
          updateSpecificationAction(args.specification.uuid, prevState, input)
      : createSpecificationAction;

  const [state, dispatch, isPending] = useActionState(action, {});

  const specification = args.mode === "edit" ? args.specification : undefined;

  const form = useForm<SpecificationFormValues>({
    resolver: zodResolver(specificationFormSchema),
    defaultValues: {
      label: specification?.label ?? "",
      options: toFormOptions(specification?.options ?? []),
      // Rules saved before forcedKey existed targeted the spec itself.
      rules: (specification?.rules ?? []).map((rule) => ({
        ...rule,
        forcedKey: rule.forcedKey ?? specification?.key ?? "",
      })),
      categoryUuids: specification?.categoryUuids ?? [],
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch({
        label: values.label,
        key: slugify(values.label),
        options: toSpecOptions(values.options),
        rules: values.rules,
        categoryUuids: values.categoryUuids,
      });
    });
  });

  return { form, state, isPending, onSubmit };
};
