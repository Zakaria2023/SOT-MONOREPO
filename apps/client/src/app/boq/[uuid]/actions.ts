"use server";

import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { submitBoq } from "services";

export const submitForReview = async (formData: FormData) => {
  const boqUuid = formData.get("boqUuid");
  if (typeof boqUuid !== "string") throw new Error("Invalid BOQ");

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  await submitBoq(user.uuid, boqUuid);
  redirect(`/boq/${boqUuid}`);
};
