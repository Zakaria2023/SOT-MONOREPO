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

// Form tree -> stored tree, deriving a stable key from each label. A numeric
// sub-field stores its fixed choices in the same `options` column (flat, no
// children) — mirroring how the top-level numeric spec is persisted.
const toSpecFields = (fields: SpecFieldForm[]): SpecField[] =>
  fields.map((field) => {
    const valueType = field.valueType ?? "select";
    return {
      key: slugify(field.label),
      label: field.label,
      valueType,
      unit: valueType === "number" ? field.unit : null,
      options:
        valueType === "number"
          ? field.numericValues.map((value) => ({
              value: value.trim(),
              children: [],
            }))
          : toSpecOptions(field.options),
    };
  });

const toSpecOptions = (options: SpecOptionForm[]): SpecOption[] =>
  options.map((option) => ({
    value: option.value,
    children: toSpecFields(option.children),
  }));

// Stored tree -> editable form tree (labels only, keys dropped). Split a
// numeric sub-field's flat options back out into the chip editor.
const toFormFields = (fields: SpecField[]): SpecFieldForm[] =>
  fields.map((field) => {
    const valueType = field.valueType ?? "select";
    return {
      label: field.label,
      valueType,
      unit: field.unit ?? "",
      options: valueType === "number" ? [] : toFormOptions(field.options),
      numericValues:
        valueType === "number"
          ? field.options.map((option) => option.value)
          : [],
    };
  });

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
      groupUuid: specification?.groupUuid ?? "",
      newGroupName: "",
      valueType: specification?.valueType ?? "select",
      unit: specification?.unit ?? "",
      options:
        specification?.valueType === "number"
          ? []
          : toFormOptions(specification?.options ?? []),
      // A numeric spec stores its allowed choices in the same options column
      // (flat, no children) — split them back out for the form.
      numericValues:
        specification?.valueType === "number"
          ? (specification.options ?? []).map((option) => option.value)
          : [],
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
        groupUuid: values.groupUuid,
        newGroupName: values.newGroupName,
        valueType: values.valueType,
        unit: values.unit,
        options:
          values.valueType === "number"
            ? values.numericValues.map((value) => ({
                value: value.trim(),
                children: [],
              }))
            : toSpecOptions(values.options),
        rules: values.rules,
        categoryUuids: values.categoryUuids,
      });
    });
  });

  return { form, state, isPending, onSubmit };
};
