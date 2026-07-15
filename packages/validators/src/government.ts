import { z } from "zod";

export const governmentRequestSchema = z.object({
  officialEmail: z.string().email("Enter a valid official email").max(255),
  entityName: z.string().min(1, "Entity name is required").max(255),
  fullName: z.string().min(1, "Full name is required").max(255),
  contactNumber: z.string().min(1, "Contact number is required").max(30),
  location: z.string().min(1, "Location is required").max(255),
});

export type GovernmentRequestInput = z.infer<typeof governmentRequestSchema>;

export const governmentRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Reject reason is required").max(2000),
});

export type GovernmentRejectionInput = z.infer<
  typeof governmentRejectionSchema
>;
