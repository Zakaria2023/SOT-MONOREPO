"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ClassificationFields,
  createClassification as createClassificationRecord,
  deleteClassification as deleteClassificationRecord,
  updateClassification as updateClassificationRecord,
} from "services";
import { ActionResult, fail } from "utils";

// Only what a "use client" file has to reach through an action lives here. The
// reads a server component makes — getClassifications, getClassification — go
// straight to services, the way apps/client already calls them.
export type ClassificationActionResult = ActionResult & {
  classificationUuid?: string;
};

export const createClassification = async (
  _prevState: ClassificationActionResult,
  fields: ClassificationFields,
): Promise<ClassificationActionResult> => {
  await requireAdmin();
  try {
    await createClassificationRecord(fields);
  } catch (error) {
    return fail(error, "Failed to create classification");
  }

  revalidatePath("/classifications");
  redirect("/classifications");
};

export const updateClassification = async (
  uuid: string,
  _prevState: ClassificationActionResult,
  fields: ClassificationFields,
): Promise<ClassificationActionResult> => {
  await requireAdmin();
  try {
    await updateClassificationRecord(uuid, fields);
  } catch (error) {
    return fail(error, "Failed to update classification");
  }

  revalidatePath("/classifications");
  redirect("/classifications");
};

export const deleteClassification = async (
  uuid: string,
): Promise<ClassificationActionResult> => {
  await requireAdmin();
  try {
    await deleteClassificationRecord(uuid);
    revalidatePath("/classifications");
    return { success: true, classificationUuid: uuid };
  } catch (error) {
    return fail(error, "Failed to delete classification");
  }
};
