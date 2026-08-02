"use server";

import { requireAdmin } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  getPartnerDiscounts as getPartnerDiscountsRecord,
  setPartnerDiscounts as setPartnerDiscountsRecord,
} from "services";
import type { PartnerDiscountMap } from "services";
import { fail } from "utils";

export type PartnerDiscountsActionResult = {
  error?: string;
  success?: boolean;
};

export const getPartnerDiscounts = async (): Promise<PartnerDiscountMap> => {
  await requireAdmin();
  return getPartnerDiscountsRecord();
};

export const savePartnerDiscounts = async (
  _prevState: PartnerDiscountsActionResult,
  values: PartnerDiscountMap,
): Promise<PartnerDiscountsActionResult> => {
  await requireAdmin();
  try {
    await setPartnerDiscountsRecord(values);
  } catch (error) {
    return fail(error, "Failed to save discounts");
  }

  revalidatePath("/partner-discounts");
  return { success: true };
};
