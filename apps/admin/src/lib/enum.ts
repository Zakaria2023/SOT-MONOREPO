export const productStatuses = [
  "draft",
  "published",
  "archived",
] as const satisfies readonly string[];

export type ProductStatus = (typeof productStatuses)[number];

export const boqStatuses = [
  "draft",
  "submitted",
  "reviewed",
] as const satisfies readonly string[];

export type BoqStatus = (typeof boqStatuses)[number];
