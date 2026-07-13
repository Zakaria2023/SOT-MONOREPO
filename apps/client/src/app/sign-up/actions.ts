"use server";

import { createGovernmentRequest } from "services";
import {
  governmentRequestSchema,
  type GovernmentRequestInput,
} from "validators";

export type GovernmentRequestState = {
  error?: string;
  success?: boolean;
};

// Government entities can't self-serve a login — this records a request that an
// admin reviews and (on approval) invites to Clerk.
export const submitGovernmentRequest = async (
  _prevState: GovernmentRequestState,
  input: GovernmentRequestInput,
): Promise<GovernmentRequestState> => {
  const parsed = governmentRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please check the form and try again." };
  }

  try {
    await createGovernmentRequest(parsed.data);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to submit request.",
    };
  }
};
