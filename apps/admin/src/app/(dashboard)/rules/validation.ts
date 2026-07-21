import { z } from "zod";

export const ruleFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string(),
  kind: z.enum([
    "sum_budget",
    "count_limit",
    "per_item_threshold",
    "ratio",
    "spec_match",
  ]),
  consumerSpecUuid: z.string().min(1, "Pick the consumed specification"),
  providerSpecUuid: z.string().min(1, "Pick the capacity specification"),
  comparator: z.enum(["lte", "gte", "eq", "in", "intersects"]),
  allocation: z.enum(["pooled", "per_provider"]),
  // Registered with valueAsNumber — arrives here as a number already.
  headroomPercent: z
    .number("Enter a percent between 1 and 100")
    .int("Whole percent only")
    .min(1, "At least 1%")
    .max(100, "At most 100%"),
  // Target contention ratio for the "ratio" kind (e.g. 20 = 20:1). Ignored by
  // the other kinds.
  ratioLimit: z.number().min(0, "Enter a positive ratio"),
  // Optional consumer filter — both empty means no condition.
  conditionSpecKey: z.string(),
  conditionValue: z.string(),
  severity: z.enum(["block", "warn"]),
  enabled: z.boolean(),
});

export type RuleFormValues = z.infer<typeof ruleFormSchema>;
