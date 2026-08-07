import { z } from "zod";

export const pasteImportSchema = z.object({
  // What this run is called in the batch list. Free text: the next source is a
  // vendor nobody has named yet.
  source: z.string().trim().min(1, "Name where this came from."),
  // The category decides which attributes exist and which values each offers, so
  // a paste cannot be read without one.
  categoryUuid: z.string().min(1, "Pick the category these products go in."),
  brandUuid: z.string().min(1, "Pick the brand."),
  text: z.string().trim().min(1, "Paste the source text."),
});

export type PasteImportValues = z.infer<typeof pasteImportSchema>;

export const answerIssueSchema = z.object({
  groupKey: z.string().min(1),
  status: z.enum(["approved", "corrected", "rejected"]),
  // Set when mapping onto a value the master list already has.
  option: z.string().optional(),
  // Set when the value is genuinely new. Controlled-add: it reaches the library
  // only because this field was filled in deliberately.
  newOptionLabel: z.string().trim().optional(),
});

export type AnswerIssueValues = z.infer<typeof answerIssueSchema>;
