import { z } from "zod";

const priceField = z
  .string()
  .min(1, "Required")
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount");

export const offerSchema = z.object({
  productPrice: priceField,
  installPrice: priceField,
  programmingPrice: priceField.optional().or(z.literal("")),
  description: z
    .string()
    .min(1, "Describe your offer")
    .max(5000),
});

export type OfferInput = z.infer<typeof offerSchema>;

export const offerRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Reject reason is required").max(2000),
});

export type OfferRejectionInput = z.infer<typeof offerRejectionSchema>;
