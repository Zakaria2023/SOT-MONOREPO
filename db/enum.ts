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

export const partnerRequestStatuses = [
  "pending",
  "approved",
  "rejected",
] as const satisfies readonly string[];

export type PartnerRequestStatus = (typeof partnerRequestStatuses)[number];

export const offerStatuses = [
  "pending",
  "approved",
  "rejected",
  "selected",
] as const satisfies readonly string[];

export type OfferStatus = (typeof offerStatuses)[number];

export const cartItemKinds = [
  "solution",
  "product",
] as const satisfies readonly string[];

export type CartItemKind = (typeof cartItemKinds)[number];
