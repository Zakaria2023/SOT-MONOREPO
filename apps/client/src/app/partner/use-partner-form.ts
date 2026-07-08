"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import {
  partnerRequestSchema,
  type PartnerRequestInput,
} from "validators";
import {
  submitPartnerRequest,
  type PartnerRequestActionState,
} from "./actions";

export const usePartnerForm = () => {
  const [state, dispatch, isPending] = useActionState<
    PartnerRequestActionState,
    PartnerRequestInput
  >(submitPartnerRequest, {});

  const form = useForm<PartnerRequestInput>({
    resolver: zodResolver(partnerRequestSchema),
    defaultValues: {
      fullName: "",
      companyName: "",
      email: "",
      location: "",
      about: "",
      offer: "",
      special: "",
      serviceScope: "install-program",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch(values);
    });
  });

  return { form, state, isPending, onSubmit };
};
