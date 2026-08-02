"use server";

import { createPartnerRequest } from "services";
import { fail } from "utils";
import { partnerRequestSchema, type PartnerRequestInput } from "validators";

export type PartnerRequestActionState = {
  error?: string;
  success?: boolean;
};

export const submitPartnerRequest = async (
  _prevState: PartnerRequestActionState,
  input: PartnerRequestInput,
): Promise<PartnerRequestActionState> => {
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
