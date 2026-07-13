import { z } from "zod";

export const categoryFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  parentUuid: z.string().optional(),
  order: z.number().int().min(0).optional(),
  image: z.string().optional(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
