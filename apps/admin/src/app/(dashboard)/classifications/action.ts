"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createClassification as createClassificationRecord,
  deleteClassification as deleteClassificationRecord,
  getClassification as getClassificationRecord,
  getClassifications as getClassificationsList,
  updateClassification as updateClassificationRecord,
} from "services";
import type {
  ClassificationFields as ServiceClassificationFields,
  ClassificationListItem as ServiceClassificationListItem,
  SelectClassifications as ServiceSelectClassifications,
} from "services";

// A "use server" file may only export async functions; types are re-declared as
// local aliases so consumers can keep importing them from here.
export type ClassificationFields = ServiceClassificationFields;
export type ClassificationListItem = ServiceClassificationListItem;
export type SelectClassifications = ServiceSelectClassifications;

export type ClassificationActionResult = {
  classificationUuid?: string;
  error?: string;
  success?: boolean;
};

export const getClassifications = async (): Promise<ClassificationListItem[]> =>
  getClassificationsList();

export const getClassification = async (
  uuid: string,
): Promise<SelectClassifications | null> => getClassificationRecord(uuid);

export const createClassification = async (
  _prevState: ClassificationActionResult,
  fields: ClassificationFields,
): Promise<ClassificationActionResult> => {
  try {
    await createClassificationRecord(fields);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to create classification",
    };
  }

  revalidatePath("/classifications");
  redirect("/classifications");
};

export const updateClassification = async (
  uuid: string,
  _prevState: ClassificationActionResult,
  fields: ClassificationFields,
): Promise<ClassificationActionResult> => {
  try {
    await updateClassificationRecord(uuid, fields);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update classification",
    };
  }

  revalidatePath("/classifications");
  redirect("/classifications");
};

export const deleteClassification = async (
  uuid: string,
): Promise<ClassificationActionResult> => {
  try {
    await deleteClassificationRecord(uuid);
    revalidatePath("/classifications");
    return { success: true, classificationUuid: uuid };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete classification",
    };
  }
};
