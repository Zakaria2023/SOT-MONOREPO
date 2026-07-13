import { z } from "zod";
import { highlightSchema, specGroupSchema } from "@/lib/specs";

export const categoryFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(4, "Max 4 characters").optional(),
  description: z.string().optional(),
  parentUuid: z.string().optional(),
  order: z.number().int().min(0).optional(),
  image: z.string().optional(),
  highlights: z.array(highlightSchema),
  specGroups: z.array(specGroupSchema),
  specTemplate: z.array(
    z.object({
      label: z.string().min(1, "Required"),
      optionsText: z.string(),
    }),
  ),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
