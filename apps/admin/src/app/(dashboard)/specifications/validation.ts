import { z } from "zod";

// Recursive form tree for a specification's options and their nested sub-fields
// (no keys — those are derived from labels on save). A sub-field mirrors the
// top-level spec: it can be a dropdown ("select", with its own options) or a
// numeric field ("number", with a unit and optional fixed numeric choices).
export type SpecOptionForm = {
  value: string;
  children: SpecFieldForm[];
};

export type SpecFieldForm = {
  label: string;
  valueType: "select" | "number";
  unit: string;
  // "select" sub-field: tick several options. "number" sub-field: from–to range.
  allowMultiple: boolean;
  allowRange: boolean;
  options: SpecOptionForm[];
  numericValues: string[];
};

const numericValueSchema = z
  .string()
  .refine(
    (value) => value.trim() !== "" && Number.isFinite(Number(value.trim())),
    "Must be a number",
  );

const specFieldSchema: z.ZodType<SpecFieldForm, SpecFieldForm> = z.lazy(() =>
  z
    .object({
      label: z.string().min(1, "Required"),
      valueType: z.enum(["select", "number"]),
      unit: z.string().max(32),
      allowMultiple: z.boolean(),
      allowRange: z.boolean(),
      options: z.array(specOptionSchema),
      numericValues: z.array(numericValueSchema),
    })
    .refine(
      (field) =>
        field.valueType !== "number" || field.unit.trim().length > 0,
      {
        message: "A numeric sub-field needs a unit (e.g. W, ports, m)",
        path: ["unit"],
      },
    ),
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

export const specificationFormSchema = z
  .object({
    label: z.string().min(1, "Label is required").max(255),
    groupUuid: z.string(),
    newGroupName: z.string().max(255),
    valueType: z.enum(["select", "number"]),
    unit: z.string().max(32),
    // "select" spec: let products tick several options. "number" spec: let
    // products enter a from–to range instead of a single value.
    allowMultiple: z.boolean(),
    allowRange: z.boolean(),
    options: z.array(specOptionSchema),
    // Optional fixed choices for a numeric spec (e.g. 24 / 32 / 52 ports).
    // Products then pick from a dropdown instead of typing a free number.
    numericValues: z.array(numericValueSchema),
    rules: z.array(ruleSchema),
    categoryUuids: z.array(z.string()).min(1, "Pick at least one category"),
  })
  .refine(
    (values) => values.valueType !== "number" || values.unit.trim().length > 0,
    {
      message: "A numeric specification needs a unit (e.g. W, ports, m)",
      path: ["unit"],
    },
  );

export type SpecificationFormValues = z.infer<typeof specificationFormSchema>;
