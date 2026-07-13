"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { completeProfile, type CompleteProfileState } from "./actions";
import { completeProfileSchema, type CompleteProfileInput } from "./validation";

type CompleteProfileDefaults = {
  next: string;
  firstName: string;
  lastName: string;
};

export const useCompleteProfileForm = ({
  next,
  firstName,
  lastName,
}: CompleteProfileDefaults) => {
  const [state, dispatch, isPending] = useActionState<
    CompleteProfileState,
    CompleteProfileInput
  >(completeProfile, {});

  const form = useForm<CompleteProfileInput>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      type: "individual",
      firstName,
      middleName: "",
      lastName,
      unifiedNumber: "",
      crNumber: "",
      vatNumber: "",
      nationalAddress: "",
      crCertificate: "",
      vatCertificate: "",
      representativeName: "",
      representativeMobile: "",
      representativeEmail: "",
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
