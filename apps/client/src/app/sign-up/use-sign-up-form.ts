"use client";

import { toClerkErrorMessage } from "@/lib/clerk-error";
import { useSignUp } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { registerSchema, type RegisterInput } from "validators";

type SignUpState = {
  error?: string;
};

/** Which panel the sign-up card is showing. */
export type SignUpStep = "details" | "verify";

// Sign-up is a two-step Clerk flow (new signals API) that has to run in the
// browser:
//   1. "details" — collect the profile fields + password, create the Clerk user
//      via signUp.password(), and send an email code + phone code.
//   2. "verify"  — the user enters both codes; once Clerk marks the sign-up
//      complete we finalize the session. The extra profile fields (full name,
//      company, location) ride along in `unsafeMetadata` so the webhook can
//      mirror them into our Users table.
export const useSignUpForm = () => {
  const { signUp } = useSignUp();
  const router = useRouter();

  const [step, setStep] = useState<SignUpStep>("details");
  const [state, setState] = useState<SignUpState>({});
  const [isPending, setIsPending] = useState(false);

  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [contact, setContact] = useState({ email: "", phone: "" });

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

  const onSubmitDetails = form.handleSubmit(async (values) => {
    setIsPending(true);
    setState({});

    const phone = values.phone.replace(/\s+/g, "");

    try {
      const { error } = await signUp.password({
        emailAddress: values.email,
        phoneNumber: phone,
        password: values.password,
        unsafeMetadata: {
          fullName: values.fullName,
          companyName: values.companyName ?? "",
          location: values.location ?? "",
        },
      });

      if (error) {
        setState({ error: toClerkErrorMessage(error) });
        return;
      }

      await signUp.verifications.sendEmailCode();
      await signUp.verifications.sendPhoneCode({});

      setContact({ email: values.email, phone });
      setStep("verify");
    } catch (error) {
      setState({ error: toClerkErrorMessage(error) });
    } finally {
      setIsPending(false);
    }
  });

  const onVerify = async () => {
    setIsPending(true);
    setState({});

    try {
      const emailResult = await signUp.verifications.verifyEmailCode({
        code: emailCode,
      });
      if (emailResult.error) {
        setState({ error: toClerkErrorMessage(emailResult.error, "Invalid email code.") });
        return;
      }

      const phoneResult = await signUp.verifications.verifyPhoneCode({
        code: phoneCode,
      });
      if (phoneResult.error) {
        setState({ error: toClerkErrorMessage(phoneResult.error, "Invalid phone code.") });
        return;
      }

      if (signUp.status === "complete") {
        await signUp.finalize();
        router.push("/");
        return;
      }

      setState({ error: "Verification is incomplete. Check both codes." });
    } catch (error) {
      setState({ error: toClerkErrorMessage(error, "Invalid code.") });
    } finally {
      setIsPending(false);
    }
  };

  const resend = async () => {
    try {
      await signUp.verifications.sendEmailCode();
      await signUp.verifications.sendPhoneCode({});
    } catch (error) {
      setState({ error: toClerkErrorMessage(error) });
    }
  };

  return {
    form,
    step,
    state,
    isPending,
    onSubmitDetails,
    emailCode,
    setEmailCode,
    phoneCode,
    setPhoneCode,
    onVerify,
    resend,
    contact,
  };
};
