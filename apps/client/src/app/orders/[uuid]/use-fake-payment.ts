"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { payOrder, type PayOrderResult } from "./actions";
import { fakePaymentSchema, type FakePaymentInput } from "./validation";

// Drives the fake card checkout: react-hook-form validates the card fields, then
// the server action (payOrder) settles the order. On success the action
// revalidates the page, which re-renders into its "paid" state.
export const useFakePayment = (orderUuid: string) => {
  const [state, dispatch, isPending] = useActionState<PayOrderResult, string>(
    payOrder,
    {},
  );

  const form = useForm<FakePaymentInput>({
    resolver: zodResolver(fakePaymentSchema),
    defaultValues: {
      cardName: "",
      cardNumber: "",
      expiry: "",
      cvc: "",
    },
  });

  const onSubmit = form.handleSubmit(() => {
    startTransition(() => {
      dispatch(orderUuid);
    });
  });

  return { form, state, isPending, onSubmit };
};
