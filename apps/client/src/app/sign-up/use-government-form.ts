"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import {
  governmentRequestSchema,
  type GovernmentRequestInput,
} from "validators";
import { submitGovernmentRequest } from "./actions";
import type { ActionResult } from "utils";

export const useGovernmentForm = () => {
  const [state, dispatch, isPending] = useActionState<
    ActionResult,
    GovernmentRequestInput
  >(submitGovernmentRequest, {});

  const form = useForm<GovernmentRequestInput>({
    resolver: zodResolver(governmentRequestSchema),
    defaultValues: {
      entityName: "",
      fullName: "",
      officialEmail: "",
      contactNumber: "",
      location: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch(values);
    });
  });

  return { form, state, isPending, onSubmit };
};
