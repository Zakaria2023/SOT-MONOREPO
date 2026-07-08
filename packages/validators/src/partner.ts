import { z } from "zod";

export const partnerServiceScopes = [
  "installation",
  "install-program",
] as const satisfies readonly string[];

export type PartnerServiceScope = (typeof partnerServiceScopes)[number];

export const partnerRequestSchema = z.object({
  fullName: z.string().min(1, "Partner name is required").max(255),
  companyName: z.string().min(1, "Company name is required").max(255),
  email: z.string().email("Enter a valid email address").max(255),
  location: z.string().max(255).optional(),
  about: z.string().max(5000).optional(),
  offer: z.string().max(5000).optional(),
  special: z.string().max(5000).optional(),
  serviceScope: z.enum(partnerServiceScopes),
});

export type PartnerRequestInput = z.infer<typeof partnerRequestSchema>;

export const partnerApprovalSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(255),
});

export type PartnerApprovalInput = z.infer<typeof partnerApprovalSchema>;

export const partnerRejectionSchema = z.object({
  rejectionReason: z
    .string()
    .min(1, "Reject reason is required")
    .max(2000),
});

export type PartnerRejectionInput = z.infer<typeof partnerRejectionSchema>;
