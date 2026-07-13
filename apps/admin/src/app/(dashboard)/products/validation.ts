import { aliasTermTypes, businessLines, productStatuses } from "@/db/enum";
import { highlightSchema, specGroupSchema } from "@/lib/specs";
import { z } from "zod";

export const aliasSchema = z.object({
  searchTerm: z.string().min(1, "Required"),
  termType: z.enum(aliasTermTypes),
  label: z.string().optional(),
});

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
  productFamily: z.string().optional(),
  seriesCode: z.string().max(4, "Max 4 characters").optional(),
  vendorNode: z.string().optional(),
  aliases: z.array(aliasSchema),
  linkedCategories: z.array(z.object({ categoryUuid: z.string().min(1) })),
  description: z.string().optional(),
  role: z.string().optional(),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
  isFeatured: z.boolean(),
  price: priceField, // public MSRP
  priceCost: priceField,
  priceSystemIntegrator: priceField,
  priceSubDistributor: priceField,
  priceEndUser: priceField,
  businessLine: z.enum(businessLines),
  currency: z.string().min(1, "Required").max(3),
  stock: z.number().int().min(0).optional(),
  highlights: z.array(highlightSchema).optional(),
  specGroups: z.array(specGroupSchema).optional(),
  status: z.enum(productStatuses),
  order: z.number().int().min(0).optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
