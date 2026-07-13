"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { slugify } from "utils";
import { createCategory, updateCategory } from "./action";
import type { CategoryActionResult, CategoryFields } from "./action";
import { categoryFormSchema } from "./validation";
import type { CategoryFormValues, SpecFieldForm } from "./validation";
import type { SelectCategories } from "@/db/schema/categories";
import type { SpecField } from "@/db/types";

type UseCategoryFormArgs =
  | { mode: "add" }
  | { mode: "edit"; category: SelectCategories };

// Stored template (with derived keys) -> editable form tree (labels only).
const toFormFields = (fields: SpecField[]): SpecFieldForm[] =>
  fields.map((field) => ({
    label: field.label,
    options: field.options.map((option) => ({
      value: option.value,
      children: toFormFields(option.children),
    })),
  }));

// Editable form tree -> stored template, deriving a stable key from each label.
const toSpecFields = (fields: SpecFieldForm[]): SpecField[] =>
  fields.map((field) => ({
    key: slugify(field.label),
    label: field.label,
    options: field.options.map((option) => ({
      value: option.value,
      children: toSpecFields(option.children),
    })),
  }));

export const useCategoryForm = (args: UseCategoryFormArgs) => {
  const action =
    args.mode === "edit"
      ? (prevState: CategoryActionResult, fields: CategoryFields) =>
          updateCategory(args.category.uuid, prevState, fields)
      : createCategory;

  const [state, dispatch, isPending] = useActionState(action, {});

  const category = args.mode === "edit" ? args.category : undefined;

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name ?? "",
      description: category?.description ?? "",
      parentUuid: category?.parentUuid ?? "",
      order: category?.order ?? 0,
      image: category?.image ?? "",
      specTemplate: toFormFields(category?.specTemplate ?? []),
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch({
        name: values.name,
        description: values.description || null,
        parentUuid: values.parentUuid || null,
        order: values.order,
        image: values.image || null,
        specTemplate: toSpecFields(values.specTemplate),
      });
    });
  });

  return { form, state, isPending, onSubmit };
};
