"use client";

import { toClerkErrorMessage } from "@/lib/clerk-error";
import { useSignUp } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  registerSchema,
  type RegisterInput,
  type SignUpMethod,
} from "validators";

type SignUpState = {
  error?: string;
};

/** Which panel the sign-up card is showing. */
export type SignUpStep = "details" | "verify";

// Sign-up is a two-step Clerk flow (new signals API) that runs in the browser.
// The user picks a single identifier — email or phone — so Clerk only ever
// sends one verification code. The extra profile fields (full name, company,
// location) ride along in `unsafeMetadata` for the webhook to mirror into our
// Users table.
export const useSignUpForm = () => {
  const { signUp } = useSignUp();
  const router = useRouter();

  const [step, setStep] = useState<SignUpStep>("details");
  const [state, setState] = useState<SignUpState>({});
  const [isPending, setIsPending] = useState(false);

  const [code, setCode] = useState("");
  const [verifyMethod, setVerifyMethod] = useState<SignUpMethod>("email");
  const [contact, setContact] = useState("");

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      method: "email",
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

    const unsafeMetadata = {
      fullName: values.fullName,
      companyName: values.companyName ?? "",
      location: values.location ?? "",
    };

    try {
      if (values.method === "email") {
        const email = values.email ?? "";
        const { error } = await signUp.password({
          emailAddress: email,
          password: values.password,
          unsafeMetadata,
        });
        if (error) {
          setState({ error: toClerkErrorMessage(error) });
          return;
        }
        await signUp.verifications.sendEmailCode();
        setContact(email);
      } else {
        const phone = (values.phone ?? "").replace(/\s+/g, "");
        const { error } = await signUp.password({
          phoneNumber: phone,
          password: values.password,
          unsafeMetadata,
        });
        if (error) {
          setState({ error: toClerkErrorMessage(error) });
          return;
        }
        await signUp.verifications.sendPhoneCode({});
        setContact(phone);
      }

      setVerifyMethod(values.method);
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
      const result =
        verifyMethod === "email"
          ? await signUp.verifications.verifyEmailCode({ code })
          : await signUp.verifications.verifyPhoneCode({ code });

      if (result.error) {
        setState({ error: toClerkErrorMessage(result.error, "Invalid code.") });
        return;
      }

      if (signUp.status === "complete") {
        await signUp.finalize();
        router.push("/");
        return;
      }

      setState({ error: "Verification is incomplete. Check the code." });
    } catch (error) {
      setState({ error: toClerkErrorMessage(error, "Invalid code.") });
    } finally {
      setIsPending(false);
    }
  };

  const resend = async () => {
    try {
      if (verifyMethod === "email") {
        await signUp.verifications.sendEmailCode();
      } else {
        await signUp.verifications.sendPhoneCode({});
      }
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
    code,
    setCode,
    onVerify,
    resend,
    verifyMethod,
    contact,
  };
};
