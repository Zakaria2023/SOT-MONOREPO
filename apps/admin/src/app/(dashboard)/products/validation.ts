import { productStatuses } from "@/db/enum";
import { highlightSchema, specGroupSchema } from "@/lib/specs";
import { z } from "zod";

export const productFormSchema = z.object({
  categoryUuid: z.string().min(1, "Category is required"),
  brandUuid: z.string().min(1, "Brand is required"),
  name: z.string().min(1, "Name is required").max(255),
  sku: z.string().optional(),
  model: z.string().optional(),
  partNumber: z.string().optional(),
  modelNumber: z.string().optional(),
  bom: z.string().optional(),
  description: z.string().optional(),
  role: z.string().optional(),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
  isFeatured: z.boolean(),
  price: z
    .union([
      z.literal(""),
      z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid price"),
    ])
    .optional(),
  currency: z.string().min(1, "Required").max(3),
  stock: z.number().int().min(0).optional(),
  highlights: z.array(highlightSchema).optional(),
  specGroups: z.array(specGroupSchema).optional(),
  status: z.enum(productStatuses),
  order: z.number().int().min(0).optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
