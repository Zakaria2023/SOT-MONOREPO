import { productStatuses } from "@/db/enum";
import { z } from "zod";

const priceField = z
  .union([
    z.literal(""),
    z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid price"),
  ])
  .optional();

export const productFormSchema = z.object({
  categoryUuid: z.string().min(1, "Category is required"),
  brandUuid: z.string().min(1, "Brand is required"),
  name: z.string().min(1, "Name is required").max(255),
  model: z.string().optional(),
  brandIdValue: z.string().max(255).optional(),
  seriesCode: z.string().max(4, "Max 4 characters").optional(),
  warrantyPeriod: z.string().optional(),
  warrantyRegion: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  datasheet: z.string().optional(),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
  price: priceField, // public MSRP
  currency: z.string().min(1, "Required").max(3),
  isAvailable: z.boolean(),
  specKeys: z.array(z.string()),
  technicalAttributes: z.record(z.string(), z.string()),
  status: z.enum(productStatuses),
  order: z.number().int().min(0).optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
