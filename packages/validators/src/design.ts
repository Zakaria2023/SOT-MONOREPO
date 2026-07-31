import { z } from "zod";

// ---------------------------------------------------------------------------
// The design check's inputs, shared by the web cart's Server Actions and the
// mobile API's route handlers — so a basket that is checkable on one transport
// cannot be rejected as malformed on the other.
// ---------------------------------------------------------------------------

export const selectionLineSchema = z.object({
  productUuid: z.string().uuid(),
  // A whole number of units. Zero and below are not an error, just nothing to
  // check, and the caller drops them before the engine runs.
  quantity: z.number().int().positive(),
});

// Buyer answers to project questions, keyed by ProjectVariables.uuid.
//
// A number OR a boolean, because the two kinds of question the engine asks are a
// magnitude ("how many calls at once") and a permission ("recording is in the
// cloud"). Nothing else: a string would reach an engine that compares it
// numerically, and "12" != 12 fails silently rather than loudly.
//
// Unknown keys are kept. Filtering them here would need the variable list, which
// is a database read — the check itself resolves each answer against the model
// and an answer to a deleted question simply matches nothing.
export const projectAnswersSchema = z.record(
  z.string().uuid(),
  z.union([z.number().finite(), z.boolean()]),
);

export const designCheckSchema = z.object({
  selection: z.array(selectionLineSchema),
  variables: projectAnswersSchema.optional(),
});

export type SelectionLineInput = z.infer<typeof selectionLineSchema>;
export type ProjectAnswersInput = z.infer<typeof projectAnswersSchema>;
export type DesignCheckRequest = z.infer<typeof designCheckSchema>;

/**
 * Read project answers out of an untrusted JSON string — a hidden form field, or
 * a request body.
 *
 * Returns an empty object rather than throwing: an unreadable answer set must not
 * cost the buyer their checkout. They lose the answers, so the check falls back
 * to the authored defaults and reports what it could not run — which is the
 * honest outcome, and visible, rather than a 500 on a valid basket.
 */
export const readProjectAnswers = (raw: unknown): ProjectAnswersInput => {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return {};
  }
  try {
    const parsed = projectAnswersSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
};
