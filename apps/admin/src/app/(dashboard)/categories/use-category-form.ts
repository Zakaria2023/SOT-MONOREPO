"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { createCategory, updateCategory } from "./action";
import type { CategoryActionResult, CategoryFields } from "./action";
import { categoryFormSchema } from "./validation";
import type { CategoryFormValues } from "./validation";
import type { SelectCategories } from "@/db/schema/categories";

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
      order: category?.order ?? 0,
      image: category?.image ?? "",
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
      });
    });
  });

  return { form, state, isPending, onSubmit };
};
