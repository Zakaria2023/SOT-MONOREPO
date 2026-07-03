"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { createCategory } from "../action";
import { categoryFormSchema } from "./validation";
import type { CategoryFormValues } from "./validation";

export const useCategoryForm = () => {
  const [state, dispatch, isPending] = useActionState(createCategory, {});

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      description: "",
      parentUuid: "",
      image: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch({
        name: values.name,
        description: values.description || null,
        parentUuid: values.parentUuid || null,
        image: values.image || null,
      });
    });
  });

  return { form, state, isPending, onSubmit };
};
