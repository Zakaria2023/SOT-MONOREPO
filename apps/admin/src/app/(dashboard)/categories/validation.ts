import { z } from "zod";

// Form-side spec template tree (no keys — those are derived on save from the
// label). Each option can carry child fields shown only when it's selected.
export type SpecOptionForm = {
  value: string;
  children: SpecFieldForm[];
};

export type SpecFieldForm = {
  label: string;
  options: SpecOptionForm[];
};

const specFieldSchema: z.ZodType<SpecFieldForm, SpecFieldForm> = z.lazy(() =>
  z.object({
    label: z.string().min(1, "Required"),
    options: z.array(specOptionSchema),
  }),
);

const specOptionSchema: z.ZodType<SpecOptionForm, SpecOptionForm> = z.lazy(() =>
  z.object({
    value: z.string().min(1, "Required"),
    children: z.array(specFieldSchema),
  }),
);

export const categoryFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  parentUuid: z.string().optional(),
  order: z.number().int().min(0).optional(),
  image: z.string().optional(),
  specTemplate: z.array(specFieldSchema),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
