// The fixed list of measurement units numeric specifications pick from
// (searchable dropdown in the spec form). Physical units are a stable
// universe, so they live in code, not in an admin-managed table — adding an
// exotic new unit is a one-line change here.
export const measurementUnits = [
  // Power & electrical
  "W",
  "kW",
  "VA",
  "V",
  "A",
  "mA",
  "Ah",
  "mAh",
  // Counts
  "ports",
  "channels",
  "devices",
  "users",
  "licenses",
  // Distance & physical
  "m",
  "cm",
  "mm",
  "km",
  "kg",
  "g",
  // Data & network
  "GB",
  "TB",
  "MB",
  "Mbps",
  "Gbps",
  "MHz",
  "GHz",
  // Imaging & misc
  "MP",
  "fps",
  "lm",
  "dB",
  "dBm",
  "°C",
  "%",
  "min",
  "h",
] as const satisfies readonly string[];

export type MeasurementUnit = (typeof measurementUnits)[number];

// How a specification's value is entered on a product: picked from dropdown
// options, or typed as a number (with a unit). Numeric specs are what the
// compatibility rule engine aggregates and compares.
export const specValueTypes = [
  "select",
  "number",
] as const satisfies readonly string[];

export type SpecValueType = (typeof specValueTypes)[number];

// Compatibility rule families. Rules bind to specifications, never to
// products: any product carrying the consumer spec participates, any product
// carrying the provider spec supplies capacity.
// - sum_budget: SUM(consumer value x qty) vs pooled provider capacity
//   (e.g. total PoE draw vs switch PoE budget).
// - count_limit: SUM(qty) of consumer items vs pooled provider capacity
//   (e.g. device count vs switch port count).
// - per_item_threshold: each consumer item's own value vs the best provider
//   value (e.g. one camera's draw vs the switch per-port maximum).
export const ruleKinds = [
  "sum_budget",
  "count_limit",
  "per_item_threshold",
] as const satisfies readonly string[];

export type RuleKind = (typeof ruleKinds)[number];

export const ruleComparators = [
  "lte",
  "gte",
  "eq",
] as const satisfies readonly string[];

export type RuleComparator = (typeof ruleComparators)[number];

export const ruleSeverities = [
  "block",
  "warn",
] as const satisfies readonly string[];

export type RuleSeverity = (typeof ruleSeverities)[number];

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
// Vendor rollout staging — Active vendors appear throughout the catalog;
// Inactive ones are kept for historical/alias data but hidden from pickers.
export const vendorStatuses = [
  "active",
  "inactive",
] as const satisfies readonly string[];

export type VendorStatus = (typeof vendorStatuses)[number];

export const businessLines = [
  "consumer",
  "smb_sme_channels",
  "smb_sme_projects",
  "enterprise",
] as const satisfies readonly string[];

export type BusinessLine = (typeof businessLines)[number];
