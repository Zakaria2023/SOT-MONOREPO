"use server";

import { requireAdmin } from "@/lib/server/auth";
import { listHandoversForReview, type HandoverReviewItem } from "services";

// Read-only, deliberately.
//
// Verification itself lives in the pre-seller app, where the person who managed
// the BOQ works. Duplicating the verify action here would give two surfaces the
// power to sign off one installation, and the second one to click would be
// overwriting a decision it never saw.
//
// What the admin was missing is SIGHT of it: there was no way to answer "where
// has this job got to" without opening someone else's app.

export const getHandoversAction = async (): Promise<HandoverReviewItem[]> => {
  await requireAdmin();
  return listHandoversForReview();
};
