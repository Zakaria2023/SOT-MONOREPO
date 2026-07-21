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
      capabilities: [],
      type: "individual",
      email: "",
      contactNumber: "",
      location: "",
      firstName: "",
      middleName: "",
      lastName: "",
      fullName: "",
      companyName: "",
      unifiedNumber: "",
      crNumber: "",
      vatNumber: "",
      nationalAddress: "",
      crCertificate: "",
      vatCertificate: "",
      representativeName: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch(values);
    });
  });

  return { form, state, isPending, onSubmit };
};
