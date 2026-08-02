"use client";

import { SelectClassifications } from "@/db/schema/classifications";
import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { ClassificationFields } from "services";
import {
  ClassificationActionResult,
  createClassification,
  updateClassification,
} from "./action";
import {
  classificationFormSchema,
  ClassificationFormValues,
} from "./validation";

type UseClassificationFormArgs =
  | { mode: "add" }
  | { mode: "edit"; classification: SelectClassifications };

export const useClassificationForm = (args: UseClassificationFormArgs) => {
  const action =
    args.mode === "edit"
      ? (prevState: ClassificationActionResult, fields: ClassificationFields) =>
          updateClassification(args.classification.uuid, prevState, fields)
      : createClassification;

  const [state, dispatch, isPending] = useActionState(action, {});

  const classification = args.mode === "edit" ? args.classification : undefined;

  const form = useForm<ClassificationFormValues>({
    resolver: zodResolver(classificationFormSchema),
    defaultValues: {
      name: classification?.name ?? "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch({
        name: values.name,
      });
    });
  });

  return { form, state, isPending, onSubmit };
};
