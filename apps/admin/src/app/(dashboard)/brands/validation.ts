import { businessLines } from "@/db/enum";
import { z } from "zod";

export const brandFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  idLabel: z.string().max(100).optional(),
  note: z.string().optional(),
  description: z.string().optional(),
  parentUuid: z.string().optional(),
  order: z.number().int().min(0).optional(),
  image: z.string().optional(),
  businessLines: z.array(z.enum(businessLines)),
});

export type BrandFormValues = z.infer<typeof brandFormSchema>;
