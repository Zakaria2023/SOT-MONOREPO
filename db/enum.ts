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

// The KIND of a product alias. "barcode" is the universal global standard
// (EAN/GTIN). "manufacturer" is one vendor's identifier, labelled per vendor
// (BOM / PID / Part Number) via the alias row's `label`. The rest are extra
// searchable terms.
export const aliasTermTypes = [
  "barcode",
  "manufacturer",
  "vendor_sku",
  "model",
  "nickname",
] as const satisfies readonly string[];

export type AliasTermType = (typeof aliasTermTypes)[number];

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
