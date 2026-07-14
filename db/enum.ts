export const productStatuses = [
  "in_stock",
  "out_of_stock",
  "limited_stock",
  "pre_order",
  "in_order",
  "end_of_sale",
  "end_of_life",
] as const satisfies readonly string[];

export type ProductStatus = (typeof productStatuses)[number];

// EOL lifecycle state — RESERVED/dormant, for the end-of-life feature later.
export const lifecycleStatuses = [
  "current",
  "end_of_sale",
  "end_of_life",
] as const satisfies readonly string[];

export type LifecycleStatus = (typeof lifecycleStatuses)[number];

export const boqStatuses = [
  "draft",
  "submitted",
  "reviewed",
] as const satisfies readonly string[];

export type BoqStatus = (typeof boqStatuses)[number];

// Which kind of applicant a partner request comes from — mirrors the client
// sign-up account types. Every type submits a request for admin review.
export const partnerTypes = [
  "individual",
  "facility",
  "government",
] as const satisfies readonly string[];

export type PartnerType = (typeof partnerTypes)[number];

export const partnerRequestStatuses = [
  "pending",
  "approved",
  "rejected",
] as const satisfies readonly string[];

export type PartnerRequestStatus = (typeof partnerRequestStatuses)[number];

export const governmentRequestStatuses = [
  "pending",
  "approved",
  "rejected",
] as const satisfies readonly string[];

export type GovernmentRequestStatus =
  (typeof governmentRequestStatuses)[number];

// Client account types. "government" users only exist after an admin approves
// their request; "individual" and "facility" self-serve at sign-up.
export const userTypes = [
  "individual",
  "facility",
  "government",
] as const satisfies readonly string[];

export type UserType = (typeof userTypes)[number];

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

// Which business line a product sells under. Phase 1 runs the first two
// (fixed price, buy now); "projects" and "enterprise" are dormant (pre-order,
// vendor approval) — structure built now, activated later.
export const businessLines = [
  "consumer",
  "smb_sme_channels",
  "smb_sme_projects",
  "enterprise",
] as const satisfies readonly string[];

export type BusinessLine = (typeof businessLines)[number];
