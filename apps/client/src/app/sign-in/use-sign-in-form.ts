"use client";

import { toClerkErrorMessage } from "@/lib/clerk-error";
import { useSignIn } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { loginSchema, type LoginInput } from "validators";

type SignInState = {
  error?: string;
};

// Clerk's sign-in runs in the browser (it establishes the session there), so
// unlike our other mutations this can't route through a Server Action. Uses the
// new Clerk signals API: `useSignIn().signIn` is a resource whose methods return
// `{ error }` and whose `status` reports progress. The form component's shape is
// unchanged — it still reads { form, state, isPending }.
export const useSignInForm = () => {
  const { signIn } = useSignIn();
  const router = useRouter();
  const [state, setState] = useState<SignInState>({});
  const [isPending, setIsPending] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      keepSignedIn: false,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setIsPending(true);
    setState({});

    try {
      const { error } = await signIn.password({
        identifier: values.identifier,
        password: values.password,
      });

      if (error) {
        setState({
          error: toClerkErrorMessage(error, "Invalid email or password."),
        });
        return;
      }

      if (signIn.status === "complete") {
        await signIn.finalize();
        router.push("/");
        return;
      }

      setState({ error: "Additional verification is required to sign in." });
    } catch (error) {
      setState({
        error: toClerkErrorMessage(error, "Invalid email or password."),
      });
    } finally {
      setIsPending(false);
    }
  });

  return { form, state, isPending, onSubmit };
};
