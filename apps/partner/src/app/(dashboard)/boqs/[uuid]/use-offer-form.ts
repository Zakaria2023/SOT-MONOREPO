"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { offerSchema, type OfferInput } from "validators";
import { submitOffer, type OfferActionState } from "./actions";

type UseOfferFormArgs = {
  boqUuid: string;
  defaultValues: OfferInput;
};

export const useOfferForm = ({ boqUuid, defaultValues }: UseOfferFormArgs) => {
  const [state, dispatch, isPending] = useActionState<
    OfferActionState,
    OfferInput
  >(submitOffer.bind(null, boqUuid), {});

  const form = useForm<OfferInput>({
    resolver: zodResolver(offerSchema),
    defaultValues,
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch(values);
    });
  });

  return { form, state, isPending, onSubmit };
};
