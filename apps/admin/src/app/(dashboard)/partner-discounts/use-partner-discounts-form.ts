"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { savePartnerDiscounts } from "./action";
import { partnerDiscountsSchema } from "./validation";
import type { PartnerDiscountsFormValues } from "./validation";

type UsePartnerDiscountsFormArgs = {
  defaults: PartnerDiscountsFormValues;
};

export const usePartnerDiscountsForm = ({
  defaults,
}: UsePartnerDiscountsFormArgs) => {
  const [state, dispatch, isPending] = useActionState(savePartnerDiscounts, {});

  const form = useForm<PartnerDiscountsFormValues>({
    resolver: zodResolver(partnerDiscountsSchema),
    defaultValues: defaults,
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch(values);
    });
  });

  return { form, state, isPending, onSubmit };
};
