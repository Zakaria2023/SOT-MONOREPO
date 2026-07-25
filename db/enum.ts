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
  "count",
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
  // Added for the specification library
  "Mpps",
  "Hz",
  "years",
  "months",
  "inches",
  "U",
  "°",
  "calls",
] as const satisfies readonly string[];

export type MeasurementUnit = (typeof measurementUnits)[number];

// Navigation domains for the specification library — a functional grouping
// above SpecificationGroups (never brand-based). A stable universe, so it lives
// in code. Labels in db/label.ts (SPECIFICATION_DOMAIN_LABELS).
export const specificationDomains = [
  "core",
  "networking",
  "control_panel",
  "video",
  "access",
  "unified_comms",
  "audio",
  "power_racks",
  "passive",
] as const satisfies readonly string[];

export type SpecificationDomain = (typeof specificationDomains)[number];

// How a specification's value is entered on a product: picked from dropdown
// options, or typed as a number (with a unit). Numeric specs are what the
// compatibility rule engine aggregates and compares.
export const specValueTypes = [
  "select",
  "number",
] as const satisfies readonly string[];

export type SpecValueType = (typeof specValueTypes)[number];

// The attribute type shown in the library builder — a richer, UX-facing set
// that maps down to valueType/allowMultiple for the engine:
//   number        → valueType number (has a unit)
//   single_select → valueType select, one option
//   multi_select  → valueType select, several options (allowMultiple)
//   boolean       → valueType select with Yes/No options
//   text          → valueType select, free text (no options)
export const specInputTypes = [
  "number",
  "single_select",
  "multi_select",
  "boolean",
  "text",
] as const satisfies readonly string[];

export type SpecInputType = (typeof specInputTypes)[number];

// How far up the category tree an assignment's FILTER reaches. Only meaningful
// when the assignment has `isFilter` on — it never affects rule participation,
// which always inherits down the whole subtree.
// - branch: the facet is offered on the category it's assigned to AND every
//   descendant, so a shopper standing at Networking filters switches, APs and
//   routers together on one Port Speed facet.
// - leaf: the facet is offered only on the exact category it's assigned to.
//   Detection Range means nothing outside motion detectors, so it stays there.
export const assignmentScopes = [
  "branch",
  "leaf",
] as const satisfies readonly string[];

export type AssignmentScope = (typeof assignmentScopes)[number];

// Which kind of CLIENT-APP viewer an attribute is surfaced to. These are
// shopper audiences, not staff roles — everyone in the admin panel sees
// everything, because that is where the catalog is authored.
//
// Not a ladder: "user" and "partner" are siblings, and "everyone" is their
// union. A partner does not see a user-only attribute, and vice versa.
// Audience never affects rule participation — a partner-only attribute still
// feeds the engine for every shopper.
export const assignmentAudiences = [
  "everyone",
  "user",
  "partner",
] as const satisfies readonly string[];

export type AssignmentAudience = (typeof assignmentAudiences)[number];

// Compatibility rule families. Rules bind to specifications, never to
// products: any product carrying the consumer spec participates, any product
// carrying the provider spec supplies capacity.
// - sum_budget: SUM(consumer value x qty) vs pooled provider capacity
//   (e.g. total PoE draw vs switch PoE budget).
// - count_limit: SUM(qty) of consumer items vs pooled provider capacity
//   (e.g. device count vs switch port count).
// - per_item_threshold: each consumer item's own value vs the best provider
//   value (e.g. one camera's draw vs the switch per-port maximum).
// - ratio: SUM(demand) / SUM(supply) <= a tunable ratio (e.g. uplink
//   oversubscription ~20:1). A designed contention ratio, not a hard sum.
// - spec_match: per-item compatibility on SELECT specs — the consumer's chosen
//   value(s) must fit the provider's (equal / member-of / overlap), e.g.
//   speaker impedance ∈ amp supported impedances, codec sets intersect.
// - conditional: the limit is looked up from a table keyed by the item's OWN
//   other spec values, then its measured value is compared against that limit
//   — e.g. max cable run length depends on cable grade × link speed, so Cat6
//   at 10G allows 55 m while Cat6a at 10G allows 100 m. There is no provider
//   product on the other side; the table IS the capacity.
export const ruleKinds = [
  "sum_budget",
  "count_limit",
  "per_item_threshold",
  "ratio",
  "spec_match",
  "conditional",
] as const satisfies readonly string[];

export type RuleKind = (typeof ruleKinds)[number];

// lte/gte/eq are numeric; in/intersects are the spec_match set operators
// (in = consumer values ⊆ provider set; intersects = the two sets overlap).
export const ruleComparators = [
  "lte",
  "gte",
  "eq",
  "in",
  "intersects",
] as const satisfies readonly string[];

export type RuleComparator = (typeof ruleComparators)[number];

// How provider capacity is applied in sum/count rules:
// - pooled: all provider units act as one big pool (SUM of capacities).
// - per_provider: each provider unit is its own bin — consumers are
//   distributed across units and every unit must fit its share (e.g. each
//   switch's own PoE budget, not the fleet total).
export const ruleAllocations = [
  "pooled",
  "per_provider",
] as const satisfies readonly string[];

export type RuleAllocation = (typeof ruleAllocations)[number];

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

// The full BOQ lifecycle. One object carries these states end to end: the
// customer drafts it, the rules engine validates it, a pre-seller reviews and
// dispatches it, partners price it (offered), the customer confirms and pays
// (ordered), then the Service & Handover stages track fulfilment.
export const boqStatuses = [
  "draft",
  "validated",
  "submitted",
  "reviewed",
  "offered",
  "ordered",
  "assigned",
  "installing",
  "installed",
  "verified",
  "handed_over",
] as const satisfies readonly string[];

export type BoqStatus = (typeof boqStatuses)[number];

// A BOQ line's place in its system. `anchor` = the brain (NVR, hub, PBX,
// core switch); `peripheral` = a device that hangs off it (camera, detector,
// phone); `accessory` = supporting hardware (mounts, cabling parts). The
// completeness / requires-companion validation keys off this. Products carry
// the same enum as `systemRole`; it is snapshotted onto the BOQ line.
export const boqItemRoles = [
  "anchor",
  "peripheral",
  "accessory",
] as const satisfies readonly string[];

export type BoqItemRole = (typeof boqItemRoles)[number];

// The two revenue streams inside a BOQ. `product` = hardware at MSRP;
// `service` = labour (installation, programming, cabling). Both streams live
// as line items in the same BOQ — that is what makes it a BOQ, not a BOM.
export const boqLineTypes = [
  "product",
  "service",
] as const satisfies readonly string[];

export type BoqLineType = (typeof boqLineTypes)[number];

// Which kind of applicant a partner request comes from — mirrors the client
// sign-up account types. Every type submits a request for admin review.
export const partnerTypes = [
  "individual",
  "facility",
  "government",
] as const satisfies readonly string[];

export type PartnerType = (typeof partnerTypes)[number];

// What a partner can do — one or more capabilities, chosen on the partner
// application. Drives the per-capability discount matrix. Labels live in
// packages/validators (PARTNER_CAPABILITY_LABELS).
export const partnerCapabilities = [
  "system_integrator",
  "stock",
  "install_program",
  "install_only",
  "pre_sell",
  "post_sell",
] as const satisfies readonly string[];

export type PartnerCapability = (typeof partnerCapabilities)[number];

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
  "expired",
] as const satisfies readonly string[];

export type OfferStatus = (typeof offerStatuses)[number];

// An order is a confirmed offer moving through confirm-then-pay. It opens
// `awaiting_payment`; a successful payment flips it to `paid` (and issues the
// invoice). Payment has no live provider yet, so `paid` is reached by the
// admin/plumbing path until a gateway is wired.
export const orderStatuses = [
  "awaiting_payment",
  "paid",
  "cancelled",
  "refunded",
] as const satisfies readonly string[];

export type OrderStatus = (typeof orderStatuses)[number];

// Invoices are only ever raised for a confirmed order.
export const invoiceStatuses = [
  "issued",
  "paid",
  "void",
] as const satisfies readonly string[];

export type InvoiceStatus = (typeof invoiceStatuses)[number];

// The QA lifecycle of a handover pack (Service & Handover, stages 6–7). The
// partner assembles it (draft), submits it, the customer tests their own
// access and confirms, SOT does a remote completeness check (verified). A
// failed check or a customer complaint puts it in dispute.
export const handoverStatuses = [
  "draft",
  "submitted",
  "customer_confirmed",
  "verified",
  "disputed",
] as const satisfies readonly string[];

export type HandoverStatus = (typeof handoverStatuses)[number];

// What kind of control a handover credential transfers. offline_access = the
// user/password that reaches the system with no internet; cloud_admin = full
// owner rights on the vendor cloud project; device_access = a single device's
// static/configured login.
export const handoverCredentialTypes = [
  "offline_access",
  "cloud_admin",
  "device_access",
] as const satisfies readonly string[];

export type HandoverCredentialType = (typeof handoverCredentialTypes)[number];

// A partner earning is a PAYABLE (money SOT owes the partner for verified
// service), NOT a stored wallet balance — the distinction is legally
// meaningful (SAMA). accrued = owed after verified handover; invoiced = the
// partner has raised their ZATCA invoice to cash out; paid = transferred.
export const partnerEarningStatuses = [
  "accrued",
  "invoiced",
  "paid",
] as const satisfies readonly string[];

export type PartnerEarningStatus = (typeof partnerEarningStatuses)[number];

export const partnerPayoutStatuses = [
  "requested",
  "paid",
] as const satisfies readonly string[];

export type PartnerPayoutStatus = (typeof partnerPayoutStatuses)[number];

// How an offer's price is SHOWN — the flexibility is presentation only, the
// money always flows through SOT. all_in = one total; itemized = products +
// service broken out (same transaction as all_in); products_only = genuine
// hardware-only sale, no SOT service and NO handover guarantee.
export const offerPresentationModes = [
  "all_in",
  "itemized",
  "products_only",
] as const satisfies readonly string[];

export type OfferPresentationMode = (typeof offerPresentationModes)[number];

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
