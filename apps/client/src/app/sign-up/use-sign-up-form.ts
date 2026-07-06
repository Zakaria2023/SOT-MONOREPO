"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { registerSchema, type RegisterInput } from "validators";
import { signUp, type RegisterActionState } from "./actions";

export const useSignUpForm = () => {
  const [state, dispatch, isPending] = useActionState<
    RegisterActionState,
    RegisterInput
  >(signUp, {});

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      companyName: "",
      location: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      dispatch(values);
    });
  });

  return { form, state, isPending, onSubmit };
};
