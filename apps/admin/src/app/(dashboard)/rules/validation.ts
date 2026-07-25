import { z } from "zod";
import { ruleComparators, ruleKinds } from "@/db/enum";

// One row of a conditional rule's lookup table, as the form edits it: the
// input values keyed by spec key, and the limit that combination allows.
const lookupRowSchema = z.object({
  when: z.record(z.string(), z.string()),
  limit: z.number("Enter a numeric limit"),
});

export const ruleFormSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(255),
    description: z.string(),
    // Derived from db/enum.ts so a new family can never be added in one place
    // and forgotten here.
    kind: z.enum(ruleKinds),
    // Each side is a specification OR a project variable — the refinements
    // below enforce exactly one, since the field alone can't express that.
    consumerSpecUuid: z.string(),
    providerSpecUuid: z.string(),
    consumerVariableUuid: z.string(),
    providerVariableUuid: z.string(),
    // "conditional" only.
    lookupInputs: z.array(z.string()),
    lookupRows: z.array(lookupRowSchema),
    comparator: z.enum(ruleComparators),
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
  })
  // Exactly one operand on the consumed side.
  .refine(
    (values) =>
      [values.consumerSpecUuid, values.consumerVariableUuid].filter(Boolean)
        .length === 1,
    {
      path: ["consumerSpecUuid"],
      message: "Pick either a specification or a project variable — not both.",
    },
  )
  // The capacity side is a lookup table on a conditional rule, so it takes no
  // operand at all there; every other family needs exactly one.
  .refine(
    (values) =>
      values.kind === "conditional"
        ? [values.providerSpecUuid, values.providerVariableUuid].filter(Boolean)
            .length === 0
        : [values.providerSpecUuid, values.providerVariableUuid].filter(Boolean)
            .length === 1,
    {
      path: ["providerSpecUuid"],
      message:
        "A conditional rule reads its limit from the lookup table — leave the capacity side empty. Every other type needs exactly one.",
    },
  )
  // A conditional rule with no rows has no limit to read.
  .refine(
    (values) => values.kind !== "conditional" || values.lookupRows.length > 0,
    {
      path: ["lookupRows"],
      message: "Add at least one lookup row — that's where the limit comes from.",
    },
  );

export type RuleFormValues = z.infer<typeof ruleFormSchema>;
