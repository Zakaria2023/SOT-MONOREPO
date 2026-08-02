"use server";

import { createPartnerRequest } from "services";
import { fail, type ActionResult } from "utils";
import { partnerRequestSchema, type PartnerRequestInput } from "validators";

export const submitPartnerRequest = async (
  _prevState: ActionResult,
  input: PartnerRequestInput,
): Promise<ActionResult> => {
  const parsed = partnerRequestSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Please check the form and try again." };
  }

  try {
    await createPartnerRequest(parsed.data);
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to submit partner request.");
  }
};
