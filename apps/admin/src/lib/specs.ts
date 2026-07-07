import { z } from "zod";

const keyValueSchema = z.object({
  k: z.string().min(1, "Required"),
  v: z.string().min(1, "Required"),
});

export const highlightSchema = keyValueSchema;

export const specGroupSchema = z.object({
  title: z.string().min(1, "Required"),
  rows: z.array(keyValueSchema),
});

export type Highlight = z.infer<typeof highlightSchema>;
export type SpecGroup = z.infer<typeof specGroupSchema>;

/** Minimal form shape the shared spec editors and preview bind to. */
export type SpecFormValues = {
  highlights: Highlight[];
  specGroups: SpecGroup[];
};
