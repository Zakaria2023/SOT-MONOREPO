"use client";

import { toClerkErrorMessage } from "@/lib/clerk-error";
import { useSignUp } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  signUpSchema,
  type SignUpAccountType,
  type SignUpInput,
  type SignUpMethod,
} from "validators";

type SignUpState = {
  error?: string;
};

/** Which panel the sign-up card is showing. */
export type SignUpStep = "details" | "verify";

// The self-serve (Clerk account) sign-up for individual + facility. The user
// verifies one identifier — email or phone (for a facility, the representative's)
// — and every profile field rides along in `unsafeMetadata` for the webhook to
// mirror into our Users table.
export const useSignUpForm = (type: SignUpAccountType) => {
  const { signUp } = useSignUp();
  const router = useRouter();

  const [step, setStep] = useState<SignUpStep>("details");
  const [state, setState] = useState<SignUpState>({});
  const [isPending, setIsPending] = useState(false);
  const [code, setCode] = useState("");
  const [verifyMethod, setVerifyMethod] = useState<SignUpMethod>("email");
  const [contact, setContact] = useState("");

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      type,
      method: "email",
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      phone: "",
      unifiedNumber: "",
      crNumber: "",
      vatNumber: "",
      nationalAddress: "",
      crCertificate: "",
      vatCertificate: "",
      representativeName: "",
      representativeMobile: "",
      representativeEmail: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmitDetails = form.handleSubmit(async (values) => {
    setIsPending(true);
    setState({});

    const composedName = [values.firstName, values.middleName, values.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    const fullName =
      values.type === "facility"
        ? (values.representativeName ?? "")
        : composedName;

    // For a facility the representative's email/phone is the login identity.
    const emailAddress =
      values.type === "facility" ? values.representativeEmail : values.email;
    const phoneNumber = (
      values.type === "facility" ? values.representativeMobile : values.phone
    )?.replace(/\s+/g, "");

    const unsafeMetadata = {
      type: values.type,
      fullName,
      firstName: values.firstName ?? "",
      middleName: values.middleName ?? "",
      lastName: values.lastName ?? "",
      unifiedNumber: values.unifiedNumber ?? "",
      crNumber: values.crNumber ?? "",
      vatNumber: values.vatNumber ?? "",
      nationalAddress: values.nationalAddress ?? "",
      crCertificate: values.crCertificate ?? "",
      vatCertificate: values.vatCertificate ?? "",
      representativeName: values.representativeName ?? "",
      representativeMobile: values.representativeMobile ?? "",
      representativeEmail: values.representativeEmail ?? "",
    };

    try {
      if (values.method === "email") {
        const { error } = await signUp.password({
          emailAddress: emailAddress ?? "",
          password: values.password,
          unsafeMetadata,
        });
        if (error) {
          setState({ error: toClerkErrorMessage(error) });
          return;
        }
        await signUp.verifications.sendEmailCode();
        setContact(emailAddress ?? "");
      } else {
        const { error } = await signUp.password({
          phoneNumber: phoneNumber ?? "",
          password: values.password,
          unsafeMetadata,
        });
        if (error) {
          setState({ error: toClerkErrorMessage(error) });
          return;
        }
        await signUp.verifications.sendPhoneCode({});
        setContact(phoneNumber ?? "");
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
