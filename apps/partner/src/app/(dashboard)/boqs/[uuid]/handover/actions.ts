"use server";

import { requirePartner } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  addHandoverCredential,
  createHandoverPack,
  getPartnerHandover,
  submitHandoverPack,
  updateHandoverAsset,
} from "services";
import type { HandoverCredentialType } from "@/db/enum";
import { fail, type ActionResult } from "utils";

const guard = async (boqUuid: string) => {
  const user = await requirePartner();
  const detail = await getPartnerHandover(user.id, boqUuid);
  return { user, detail };
};

export const openPack = async (
  boqUuid: string,
): Promise<ActionResult> => {
  const user = await requirePartner();
  try {
    await createHandoverPack({ boqUuid, partnerClerkUserId: user.id });
  } catch (error) {
    return fail(error, "Failed to open pack");
  }
  revalidatePath(`/boqs/${boqUuid}/handover`);
  return { success: true };
};

export const saveAsset = async (
  boqUuid: string,
  assetUuid: string,
  values: {
    location?: string;
    localIp?: string;
    port?: string;
    macAddress?: string;
    serialNumber?: string;
  },
): Promise<ActionResult> => {
  const user = await requirePartner();
  try {
    await updateHandoverAsset({
      partnerClerkUserId: user.id,
      assetUuid,
      values,
    });
  } catch (error) {
    return fail(error, "Failed to save device");
  }
  revalidatePath(`/boqs/${boqUuid}/handover`);
  return { success: true };
};

export const addCredential = async (
  boqUuid: string,
  values: {
    type: HandoverCredentialType;
    label: string;
    target?: string;
    username?: string;
    secret?: string;
  },
): Promise<ActionResult> => {
  const { user, detail } = await guard(boqUuid);
  if (!detail) {
    return { error: "Handover pack not found" };
  }

  try {
    await addHandoverCredential({
      partnerClerkUserId: user.id,
      packUuid: detail.pack.uuid,
      values,
    });
  } catch (error) {
    return fail(error, "Failed to add credential");
  }
  revalidatePath(`/boqs/${boqUuid}/handover`);
  return { success: true };
};

export const submitPack = async (
  boqUuid: string,
  trainingNotes?: string,
): Promise<ActionResult> => {
  const { user, detail } = await guard(boqUuid);
  if (!detail) {
    return { error: "Handover pack not found" };
  }

  try {
    await submitHandoverPack({
      partnerClerkUserId: user.id,
      packUuid: detail.pack.uuid,
      trainingNotes,
    });
  } catch (error) {
    return fail(error, "Failed to submit pack");
  }
  revalidatePath(`/boqs/${boqUuid}/handover`);
  return { success: true };
};
