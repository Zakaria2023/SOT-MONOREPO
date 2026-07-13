"use server";

import { createGovernmentRequest } from "services";
import { uploadDocumentFile } from "storage";
import {
  governmentRequestSchema,
  type GovernmentRequestInput,
} from "validators";

export type UploadCertificateResult = {
  documentId?: string;
  fileName?: string;
  error?: string;
};

// Uploads a facility certificate straight to R2 via storage — no route handler.
// Used by the CertificateUpload component during sign-up and complete-profile.
export const uploadCertificate = async (
  formData: FormData,
): Promise<UploadCertificateResult> => {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file provided" };
  }

  try {
    return await uploadDocumentFile(file);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Upload failed.",
    };
  }
};

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
