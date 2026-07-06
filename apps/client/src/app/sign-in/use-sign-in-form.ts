"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { loginSchema, type LoginInput } from "validators";
import { signIn, type LoginActionState } from "./actions";

export const useSignInForm = () => {
  const [state, dispatch, isPending] = useActionState<
    LoginActionState,
    LoginInput
  >(signIn, {});

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      keepSignedIn: false,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch(values);
    });
  });

  return { form, state, isPending, onSubmit };
};
