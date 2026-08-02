"use server";

import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { updateUserProfile, type UpdateUserProfileInput } from "services";
import { completeProfileSchema, type CompleteProfileInput } from "./validation";
import { fail } from "utils";

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
    return { error: "Please check the form and try again." };
  }

  const data = parsed.data;
  const fields: UpdateUserProfileInput =
    data.type === "individual"
      ? {
          type: "individual",
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          location: data.location,
          fullName: [data.firstName, data.middleName, data.lastName]
            .filter(Boolean)
            .join(" ")
            .trim(),
        }
      : {
          type: "facility",
          fullName: data.representativeName,
          unifiedNumber: data.unifiedNumber,
          crNumber: data.crNumber,
          vatNumber: data.vatNumber,
          nationalAddress: data.nationalAddress,
          crCertificate: data.crCertificate,
          vatCertificate: data.vatCertificate,
          representativeName: data.representativeName,
          representativeMobile: data.representativeMobile,
          representativeEmail: data.representativeEmail,
        };

  try {
    await updateUserProfile(user.uuid, fields);
  } catch (error) {
    return fail(error, "Failed to save profile.");
  }

  redirect(safeNext(data.next));
};
