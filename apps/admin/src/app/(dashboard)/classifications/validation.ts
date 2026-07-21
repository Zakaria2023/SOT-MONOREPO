import { z } from "zod";

export const classificationFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
});

export type ClassificationFormValues = z.infer<typeof classificationFormSchema>;
