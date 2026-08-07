"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { createBatchFromPaste, type ImportActionResult } from "./action";
import { pasteImportSchema, type PasteImportValues } from "./validation";

export const usePasteImportForm = () => {
  const [state, dispatch, isPending] = useActionState<
    ImportActionResult,
    PasteImportValues
  >(createBatchFromPaste, {});

  const form = useForm<PasteImportValues>({
    resolver: zodResolver(pasteImportSchema),
    defaultValues: { source: "", categoryUuid: "", brandUuid: "", text: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch(values);
    });
  });

  return { form, state, isPending, onSubmit };
};
