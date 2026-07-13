"use server";

import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { updateUserProfile } from "services";
import { completeProfileSchema, type CompleteProfileInput } from "./validation";

export type CompleteProfileState = {
  error?: string;
};

// Only allow internal redirect targets so `next` can't bounce the user offsite.
const safeNext = (next: string | undefined): string =>
  next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

export const completeProfile = async (
  _prevState: CompleteProfileState,
  input: CompleteProfileInput,
): Promise<CompleteProfileState> => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const parsed = completeProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please select your location." };
  }

  try {
    await updateUserProfile(user.uuid, { location: parsed.data.location });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to save profile.",
    };
  }

  redirect(safeNext(parsed.data.next));
};
