"use client";

import { toClerkErrorMessage } from "@/lib/clerk-error";
import { useSignIn } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  forgotPasswordRequestSchema,
  forgotPasswordResetSchema,
  type ForgotPasswordRequestInput,
  type ForgotPasswordResetInput,
} from "./validation";

type ForgotPasswordState = {
  error?: string;
};

/** Which panel the reset card is showing. */
export type ForgotPasswordStep = "request" | "reset";

// Clerk's password reset runs in the browser (it establishes the session
// there), so — like sign-in — it can't route through a Server Action. Uses the
// signals API: `signIn.create` identifies the account, then
// `resetPasswordEmailCode` sends a code, verifies it, and submits the new
// password before `finalize()` sets the session.
export const useForgotPasswordForm = () => {
  const { signIn } = useSignIn();
  const router = useRouter();

  const [step, setStep] = useState<ForgotPasswordStep>("request");
  const [state, setState] = useState<ForgotPasswordState>({});
  const [isPending, setIsPending] = useState(false);
  const [email, setEmail] = useState("");

  const requestForm = useForm<ForgotPasswordRequestInput>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ForgotPasswordResetInput>({
    resolver: zodResolver(forgotPasswordResetSchema),
    defaultValues: { code: "", password: "", confirmPassword: "" },
  });

  const onRequest = requestForm.handleSubmit(async ({ email: value }) => {
    setIsPending(true);
    setState({});

    try {
      const created = await signIn.create({ identifier: value });
      if (created.error) {
        setState({
          error: toClerkErrorMessage(
            created.error,
            "We couldn't start a reset for that email.",
          ),
        });
        return;
      }

      const sent = await signIn.resetPasswordEmailCode.sendCode();
      if (sent.error) {
        setState({ error: toClerkErrorMessage(sent.error) });
        return;
      }

      setEmail(value);
      setStep("reset");
    } catch (error) {
      setState({
        error: toClerkErrorMessage(
          error,
          "We couldn't start a reset for that email.",
        ),
      });
    } finally {
      setIsPending(false);
    }
  });

  const onReset = resetForm.handleSubmit(async ({ code, password }) => {
    setIsPending(true);
    setState({});

    try {
      const verified = await signIn.resetPasswordEmailCode.verifyCode({ code });
      if (verified.error) {
        setState({
          error: toClerkErrorMessage(
            verified.error,
            "Invalid or expired code.",
          ),
        });
        return;
      }

      const submitted = await signIn.resetPasswordEmailCode.submitPassword({
        password,
      });
      if (submitted.error) {
        setState({ error: toClerkErrorMessage(submitted.error) });
        return;
      }

      if (signIn.status === "complete") {
        await signIn.finalize();
        router.push("/");
        return;
      }

      setState({ error: "Something went wrong finishing the reset." });
    } catch (error) {
      setState({
        error: toClerkErrorMessage(error, "Invalid or expired code."),
      });
    } finally {
      setIsPending(false);
    }
  });

  const resend = async () => {
    try {
      await signIn.resetPasswordEmailCode.sendCode();
    } catch (error) {
      setState({ error: toClerkErrorMessage(error) });
    }
  };

  return {
    step,
    state,
    isPending,
    email,
    requestForm,
    resetForm,
    onRequest,
    onReset,
    resend,
  };
};
