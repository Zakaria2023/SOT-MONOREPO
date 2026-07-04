import { z } from "zod";
import { productStatuses } from "@/lib/enum";

const highlightSchema = z.object({
  k: z.string().min(1, "Required"),
  v: z.string().min(1, "Required"),
});

const specRowSchema = z.object({
  k: z.string().min(1, "Required"),
  v: z.string().min(1, "Required"),
});

const specGroupSchema = z.object({
  title: z.string().min(1, "Required"),
  rows: z.array(specRowSchema),
});

export const productFormSchema = z.object({
  categoryUuid: z.string().min(1, "Category is required"),
  brandUuid: z.string().min(1, "Brand is required"),
  name: z.string().min(1, "Name is required").max(255),
  sku: z.string().optional(),
  model: z.string().optional(),
  blurb: z.string().optional(),
  description: z.string().optional(),
  role: z.string().optional(),
  image: z.string().optional(),
  iconKey: z.string().optional(),
  ribbon: z.string().optional(),
  isFeatured: z.boolean(),
  price: z
    .string()
    .min(1, "Price is required")
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid price"),
  currency: z.string().min(1, "Required").max(3),
  stock: z.number().int().min(0).optional(),
  highlights: z.array(highlightSchema).optional(),
  specGroups: z.array(specGroupSchema).optional(),
  status: z.enum(productStatuses),
  order: z.number().int().min(0).optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
