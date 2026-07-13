"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { completeProfile, type CompleteProfileState } from "./actions";
import { completeProfileSchema, type CompleteProfileInput } from "./validation";

export const useCompleteProfileForm = (next: string) => {
  const [state, dispatch, isPending] = useActionState<
    CompleteProfileState,
    CompleteProfileInput
  >(completeProfile, {});

  const form = useForm<CompleteProfileInput>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      location: "",
      next,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch(values);
    });
  });

  return { form, state, isPending, onSubmit };
};
