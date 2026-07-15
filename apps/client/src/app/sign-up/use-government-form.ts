"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import {
  governmentRequestSchema,
  type GovernmentRequestInput,
} from "validators";
import {
  submitGovernmentRequest,
  type GovernmentRequestState,
} from "./actions";

export const useGovernmentForm = () => {
  const [state, dispatch, isPending] = useActionState<
    GovernmentRequestState,
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
