"use client";

import { SelectCategories } from "@/db/schema/categories";
import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { CategoryFields } from "services";
import { CategoryActionResult, createCategory, updateCategory } from "./action";
import { categoryFormSchema, CategoryFormValues } from "./validation";

type UseCategoryFormArgs =
  | { mode: "add" }
  | { mode: "edit"; category: SelectCategories };

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
      classificationUuid: category?.classificationUuid ?? "",
      image: category?.image ?? "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch({
        name: values.name,
        description: values.description || null,
        parentUuid: values.parentUuid || null,
        classificationUuid: values.classificationUuid || null,
        image: values.image || null,
      });
    });
  });

  return { form, state, isPending, onSubmit };
};
