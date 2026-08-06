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
  // Half the product's identity, not a label — see Products.variant.
  variant: z.string().max(120).optional(),
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
  // Keyed by Specifications.uuid and typed: a number stays a number, a
  // multi-select stays an array. The server normalises and clears hidden values
  // again before writing, so the form is convenience, never the authority.
  specValues: z.record(
    z.string(),
    z.union([
      z.number(),
      z.boolean(),
      z.string(),
      z.array(z.string()),
      // A span. Both ends required — a half-filled one is not a value, and the
      // server drops it rather than storing something it cannot read back.
      z.object({ min: z.number(), max: z.number() }),
      // A group's repeatable rows: sub-field key → count or pick. Listed AFTER
      // `array(string)` so a multi-select still matches the narrower branch
      // first, and every row value is required for the same reason both ends of
      // a span are — the readers drop an incomplete row, so storing one would
      // show the author a filled field that no rule can see.
      z.array(z.record(z.string(), z.union([z.number(), z.string()]))),
    ]),
  ),
  status: z.enum(productStatuses),
  order: z.number().int().min(0).optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
