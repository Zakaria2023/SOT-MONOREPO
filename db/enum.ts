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

// The physical dimension each unit measures, and how many BASE units one of it
// is worth. A rule may only compare two operands whose units share a dimension;
// when they do, both sides are converted to the base before any arithmetic.
//
// Without this, an attribute in kW and an attribute in W sum together with no
// error and the design check confidently approves a 1000× overload. Units the
// engine never does arithmetic on are simply absent — an unlisted unit is
// treated as dimensionless and may only be compared against the same unit
// string, which is the safe fallback rather than a silent conversion.
export type UnitDimension = {
  dimension: string;
  // Multiply a value in this unit by `toBase` to get the dimension's base unit.
  toBase: number;
};

export const UNIT_DIMENSIONS: Partial<Record<MeasurementUnit, UnitDimension>> =
  {
    // Power — base W
    W: { dimension: "power", toBase: 1 },
    kW: { dimension: "power", toBase: 1000 },
    // Apparent power is deliberately its OWN dimension: 1500 VA is not 1500 W,
    // and letting them convert would be the classic UPS sizing mistake.
    VA: { dimension: "apparent_power", toBase: 1 },
    // Electrical
    V: { dimension: "voltage", toBase: 1 },
    A: { dimension: "current", toBase: 1 },
    mA: { dimension: "current", toBase: 0.001 },
    Ah: { dimension: "charge", toBase: 1 },
    mAh: { dimension: "charge", toBase: 0.001 },
    // Distance — base m
    m: { dimension: "distance", toBase: 1 },
    cm: { dimension: "distance", toBase: 0.01 },
    mm: { dimension: "distance", toBase: 0.001 },
    km: { dimension: "distance", toBase: 1000 },
    // Mass — base g
    kg: { dimension: "mass", toBase: 1000 },
    g: { dimension: "mass", toBase: 1 },
    // Storage — base MB
    MB: { dimension: "storage", toBase: 1 },
    GB: { dimension: "storage", toBase: 1000 },
    TB: { dimension: "storage", toBase: 1000000 },
    // Throughput — base Mbps
    Mbps: { dimension: "throughput", toBase: 1 },
    Gbps: { dimension: "throughput", toBase: 1000 },
    // Frequency — base MHz
    MHz: { dimension: "frequency", toBase: 1 },
    GHz: { dimension: "frequency", toBase: 1000 },
    Hz: { dimension: "frequency", toBase: 0.000001 },
    // Time — base min
    min: { dimension: "duration", toBase: 1 },
    h: { dimension: "duration", toBase: 60 },
    months: { dimension: "period", toBase: 1 },
    years: { dimension: "period", toBase: 12 },
    // Countable things. Each is its own dimension so "ports" never sums with
    // "channels" just because both happen to be integers.
    count: { dimension: "count", toBase: 1 },
    ports: { dimension: "ports", toBase: 1 },
    channels: { dimension: "channels", toBase: 1 },
    devices: { dimension: "devices", toBase: 1 },
    users: { dimension: "users", toBase: 1 },
    licenses: { dimension: "licenses", toBase: 1 },
    calls: { dimension: "calls", toBase: 1 },
  };

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

// What kind of value an attribute holds. ONE stored type — not a UX type plus
// an engine type derived from it, because two stored fields for one fact can
// disagree in the database and then nothing knows which is true.
//
//   number        — a magnitude with a unit. The only type arithmetic runs on.
//   single_select — exactly one option from the master list.
//   multi_select  — any number of options from the master list.
//   boolean       — a REAL true/false. Deliberately not a two-option select of
//                   the strings "Yes"/"No": a rule that compares the string
//                   "Yes" breaks the moment someone relabels the option, and
//                   every such bug looks like a passing check.
//   group         — a REPEATABLE row of counts and picks, defined by the
//                   attribute's own `groupFields` schema.
//
// `group` exists because some facts are a list, not a value. "24 × 1G BASE-T,
// 16 × 10G SFP" is four port groups on one switch, and no single option can hold
// it: crammed into one select the list forks into a new option per switch and
// stops being comparable, which is the failure that produced free-typed specs in
// the first place. One type covers every such fact we have — network ports,
// power outlets, and slot systems are all {how many, of which kind}.
//
// There is no `text` type. Free text can never feed a rule, and an attribute
// that cannot feed a rule or a filter is marketing copy — it belongs on the
// product, not in a registry whose whole purpose is machine comparison.
export const specificationTypes = [
  "number",
  "single_select",
  "multi_select",
  "boolean",
  "group",
] as const satisfies readonly string[];

export type SpecificationType = (typeof specificationTypes)[number];

/**
 * The types whose values come from the master option list.
 *
 * `group` is NOT one of them, even though its rows contain picks: those lists
 * belong to the sub-fields inside `groupFields`, not to the attribute. Treating a
 * group as option-backed would point the option editor and every enabled-slice
 * narrowing at an empty master list.
 */
export const optionBackedTypes = [
  "single_select",
  "multi_select",
] as const satisfies readonly string[];

export const isOptionBacked = (type: SpecificationType): boolean =>
  type === "single_select" || type === "multi_select";

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

// What "matches" means when the attribute being tested holds SEVERAL values at
// once (a multi-select). Both readings are legitimate and they disagree on the
// same product, so the author picks:
//   any → the item's values overlap the listed values (the common case)
//   all → the item's values are a SUBSET of the listed values — "only PoE,
//         nothing else", which `any` cannot express.
export const matchModes = ["any", "all"] as const satisfies readonly string[];

export type MatchMode = (typeof matchModes)[number];

// The operators of the ONE predicate language, shared by the conditional reveal
// on an assignment, both side-filters on a relationship, and presence triggers.
export const predicateOperators = [
  "equals",
  "not_equals",
  "in",
  "not_in",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "exists",
  "in_category",
  "all",
  "any",
  "not",
] as const satisfies readonly string[];

export type PredicateOperator = (typeof predicateOperators)[number];

// The six relationship families. A relationship references ATTRIBUTES, never
// products: anything carrying the consumer operand participates, anything
// carrying the provider operand supplies capacity, so a new SKU joins every
// existing rule with zero configuration.
//
// - budget:      Σ(demand × qty) fits the provider capacity. Set `perItem` to
//                judge each unit against the single best provider value
//                instead (one camera's draw vs the per-port maximum) — a mode,
//                not a seventh family, because it is the same comparison with
//                a different aggregation.
// - count:       the same evaluator with an `item_count` consumer operand —
//                Σ(qty of matching items) vs capacity (cameras vs channels).
// - match:       per-item value compatibility (a PoE af device fits an at
//                switch; two codec sets must overlap). No arithmetic.
// - ratio:       demand ÷ supply must stay within a designed contention ratio
//                (uplink oversubscription). A derating, not a hard sum.
// - presence:    a companion that SHOULD be in the selection and ISN'T. The
//                only family that scans for absence, so it is also the only
//                one that can report "you forgot the recorder".
// - conditional: the limit comes from the rule's own lookup table keyed by the
//                item's other values (Cat6 at 10G runs 55 m, Cat6a runs 100 m).
//                There is no provider product; the table IS the capacity.
export const relationshipFamilies = [
  "budget",
  "count",
  "match",
  "ratio",
  "presence",
  "conditional",
] as const satisfies readonly string[];

export type RelationshipFamily = (typeof relationshipFamilies)[number];

// lte/gte/eq are the numeric comparisons. `in` and `intersects` are the set
// operators the match family uses: `in` = the consumer's values are a subset of
// the provider's; `intersects` = the two sets overlap.
//
// On an ORDERED attribute, lte/gte compare the option's `rank`, which is what
// makes "at most 802.3at" meaningful on a dropdown. On an unordered attribute
// there is no "at most", so they degrade to plain membership rather than
// silently comparing alphabetical position.
export const relationshipComparators = [
  "lte",
  "gte",
  "eq",
  "in",
  "intersects",
] as const satisfies readonly string[];

export type RelationshipComparator = (typeof relationshipComparators)[number];

// How provider capacity is applied.
// - per_unit: each provider unit is its own bin; consumers are distributed and
//   every unit must fit its share. THE DEFAULT, because two switches with 130 W
//   each are not one switch with 260 W — pooling would approve a design where a
//   single 200 W load cannot physically attach to either.
// - pooled: all provider units act as one capacity. Correct only where the
//   resource genuinely is shared (licences, a site-wide budget).
export const relationshipAllocations = [
  "per_unit",
  "pooled",
] as const satisfies readonly string[];

export type RelationshipAllocation = (typeof relationshipAllocations)[number];

// One severity vocabulary for the whole system. `hard`/`soft` are deliberately
// NOT also in use anywhere — two words for one concept is how an API ends up
// translating between them and getting a gate backwards.
export const relationshipGates = [
  "block",
  "warn",
] as const satisfies readonly string[];

export type RelationshipGate = (typeof relationshipGates)[number];

// A wrong rule blocks real sales across the whole catalog the instant it is
// saved, so rules are authored as drafts, previewed against a real selection,
// and only then published. Only `published` rules ever gate a buyer.
export const relationshipStatuses = [
  "draft",
  "published",
  "archived",
] as const satisfies readonly string[];

export type RelationshipStatus = (typeof relationshipStatuses)[number];

// A project input is a number (or a yes/no) the BUYER supplies — expected
// concurrent calls, retention days, uplink capacity. It is a rule operand
// exactly like an attribute, which is what lets the Ratio family exist at all.
export const projectVariableTypes = [
  "number",
  "boolean",
] as const satisfies readonly string[];

export type ProjectVariableType = (typeof projectVariableTypes)[number];

// What a catalog change was, for the audit trail. Rules and assignments are the
// things that get blamed when a sale is blocked, so who changed what and when
// has to be answerable.
export const catalogAuditTargets = [
  "specification",
  "assignment",
  "relationship",
  "project_variable",
] as const satisfies readonly string[];

export type CatalogAuditTarget = (typeof catalogAuditTargets)[number];

export const catalogAuditActions = [
  "create",
  "update",
  "delete",
  "publish",
] as const satisfies readonly string[];

export type CatalogAuditAction = (typeof catalogAuditActions)[number];

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
