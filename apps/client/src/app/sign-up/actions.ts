"use server";

import { createGovernmentRequest } from "services";
import {
  governmentRequestSchema,
  type GovernmentRequestInput,
} from "validators";
import { fail, type ActionResult } from "utils";

// Government entities can't self-serve a login — this records a request that an
// admin reviews and (on approval) invites to Clerk.
export const submitGovernmentRequest = async (
  _prevState: ActionResult,
  input: GovernmentRequestInput,
): Promise<ActionResult> => {
  const parsed = governmentRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please check the form and try again." };
  }

  try {
    await createGovernmentRequest(parsed.data);
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to submit request.");
  }
};
