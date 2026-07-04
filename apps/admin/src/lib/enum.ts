export const productStatuses = [
  "draft",
  "published",
  "archived",
] as const satisfies readonly string[];

export type ProductStatus = (typeof productStatuses)[number];
