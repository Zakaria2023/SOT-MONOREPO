import { z } from "zod";

// Recursive form tree for a specification's options and their nested sub-fields
// (no keys — those are derived from labels on save).
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

const ruleClauseSchema = z.object({
  specKey: z.string().min(1, "Pick a specification"),
  values: z.array(z.string()).min(1, "Pick at least one value"),
});

const ruleSchema = z.object({
  match: z.enum(["all", "any"]),
  clauses: z.array(ruleClauseSchema).min(1, "Add at least one condition"),
  forcedKey: z.string().min(1, "Pick the field to force"),
  forcedValue: z.string().min(1, "Pick the value to force"),
});

export const specificationFormSchema = z.object({
  label: z.string().min(1, "Label is required").max(255),
  options: z.array(specOptionSchema),
  rules: z.array(ruleSchema),
  categoryUuids: z.array(z.string()).min(1, "Pick at least one category"),
});

export type SpecificationFormValues = z.infer<typeof specificationFormSchema>;
