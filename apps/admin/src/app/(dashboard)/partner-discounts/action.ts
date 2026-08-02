"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  getPartnerDiscounts as getPartnerDiscountsRecord,
  setPartnerDiscounts as setPartnerDiscountsRecord,
} from "services";
import type { PartnerDiscountMap } from "services";
import { fail, type ActionResult } from "utils";

export const getPartnerDiscounts = async (): Promise<PartnerDiscountMap> => {
  await requireAdmin();
  return getPartnerDiscountsRecord();
};

export const savePartnerDiscounts = async (
  _prevState: ActionResult,
  values: PartnerDiscountMap,
): Promise<ActionResult> => {
  await requireAdmin();
  try {
    await setPartnerDiscountsRecord(values);
  } catch (error) {
    return fail(error, "Failed to save discounts");
  }

  revalidatePath("/partner-discounts");
  return { success: true };
};
