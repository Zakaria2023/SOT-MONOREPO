import { PartnerServiceScope } from "../packages/validators/src/partner";
import {
  AssignmentAudience,
  AssignmentScope,
  BusinessLine,
  BoqItemRole,
  BoqLineType,
  BoqStatus,
  GovernmentRequestStatus,
  HandoverCredentialType,
  HandoverStatus,
  InvoiceStatus,
  OfferPresentationMode,
  OfferStatus,
  OrderStatus,
  PartnerEarningStatus,
  PartnerPayoutStatus,
  PartnerRequestStatus,
  PartnerType,
  ProductStatus,
  ProjectVariableType,
  MatchMode,
  PredicateOperator,
  RelationshipAllocation,
  RelationshipComparator,
  RelationshipFamily,
  RelationshipGate,
  RelationshipStatus,
  SpecificationDomain,
  SpecificationType,
  UserType,
} from "./enum";

export const SPECIFICATION_DOMAIN_LABELS: Record<SpecificationDomain, string> = {
  core: "Core",
  networking: "Networking & Connectivity",
  control_panel: "Control-Panel Systems",
  video: "Video Surveillance",
  access: "Access Control & Intercom",
  unified_comms: "Unified Communications",
  audio: "Audio & Multiroom",
  power_racks: "Power Protection & Racks",
  passive: "Passive / Cabling",
};

export const RELATIONSHIP_FAMILY_LABELS: Record<RelationshipFamily, string> = {
  budget: "Budget — capacity ≥ Σ demand",
  count: "Count — items ≤ a limit",
  match: "Match — two values compatible",
  ratio: "Ratio — demand ÷ supply ≤ target",
  presence: "Presence — requires a companion",
  conditional: "Conditional — limit from a lookup",
};

// One line each, written for the author choosing a family in the builder.
export const RELATIONSHIP_FAMILY_HINTS: Record<RelationshipFamily, string> = {
  budget:
    "Adds up what the selection draws and checks it fits what the selection supplies.",
  count: "Counts matching items and checks they fit the available slots.",
  match:
    "Checks one item's value is compatible with another's — no arithmetic.",
  ratio:
    "Allows deliberate oversubscription: demand may exceed supply up to a target ratio.",
  presence: "Detects something that should be in the selection but is missing.",
  conditional:
    "Reads the limit from a table keyed by the item's own other values.",
};

export const RELATIONSHIP_COMPARATOR_LABELS: Record<
  RelationshipComparator,
  string
> = {
  lte: "must be at most",
  gte: "must be at least",
  eq: "must equal",
  in: "must be one of",
  intersects: "must overlap",
};

export const RELATIONSHIP_GATE_LABELS: Record<RelationshipGate, string> = {
  block: "Blocks checkout",
  warn: "Warns only",
};

export const RELATIONSHIP_STATUS_LABELS: Record<RelationshipStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const RELATIONSHIP_ALLOCATION_LABELS: Record<
  RelationshipAllocation,
  string
> = {
  per_unit: "Each device on its own",
  pooled: "Shared pool",
};

export const RELATIONSHIP_ALLOCATION_HINTS: Record<
  RelationshipAllocation,
  string
> = {
  per_unit:
    "Two switches with 130 W each are not one switch with 260 W — every device must fit its own share.",
  pooled:
    "All providers act as one capacity. Correct only where the resource really is shared.",
};

export const MATCH_MODE_LABELS: Record<MatchMode, string> = {
  any: "any of the values match",
  all: "only these values, nothing else",
};

export const PROJECT_VARIABLE_TYPE_LABELS: Record<ProjectVariableType, string> =
  {
    number: "Number",
    boolean: "Yes / No",
  };

export const PREDICATE_OPERATOR_LABELS: Record<PredicateOperator, string> = {
  equals: "is",
  not_equals: "is not",
  in: "is one of",
  not_in: "is none of",
  gt: "is more than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  between: "is between",
  exists: "has any value",
  all: "all of",
  any: "any of",
  not: "not",
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  in_stock: "In Stock",
  out_of_stock: "Out of Stock",
  limited_stock: "Limited Stock",
  pre_order: "Pre Order",
  in_order: "In Order",
  end_of_sale: "End of Sale (EOS)",
  end_of_life: "End of Life (EOL)",
};

export const BOQ_STATUS_LABELS: Record<BoqStatus, string> = {
  draft: "Draft",
  validated: "Validated",
  submitted: "Submitted",
  reviewed: "Reviewed",
  offered: "Offered",
  ordered: "Ordered",
  assigned: "Assigned",
  installing: "Installing",
  installed: "Installed",
  verified: "Verified",
  handed_over: "Handed over",
};

export const BOQ_ITEM_ROLE_LABELS: Record<BoqItemRole, string> = {
  anchor: "Anchor",
  peripheral: "Peripheral",
  accessory: "Accessory",
};

export const BOQ_LINE_TYPE_LABELS: Record<BoqLineType, string> = {
  product: "Product",
  service: "Service",
};

export const PARTNER_REQUEST_STATUS_LABELS: Record<
  PartnerRequestStatus,
  string
> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const PARTNER_SERVICE_SCOPE_LABELS: Record<PartnerServiceScope, string> =
  {
    installation: "Installation only",
    "install-program": "Install + program",
  };

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  selected: "Selected by customer",
  expired: "Expired",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  issued: "Issued",
  paid: "Paid",
  void: "Void",
};

export const HANDOVER_STATUS_LABELS: Record<HandoverStatus, string> = {
  draft: "Draft",
  submitted: "Awaiting your confirmation",
  customer_confirmed: "Confirmed by customer",
  verified: "Verified",
  disputed: "Disputed",
};

export const HANDOVER_CREDENTIAL_TYPE_LABELS: Record<
  HandoverCredentialType,
  string
> = {
  offline_access: "Offline access (user + password)",
  cloud_admin: "Cloud project (admin / owner)",
  device_access: "Device access",
};

export const PARTNER_EARNING_STATUS_LABELS: Record<
  PartnerEarningStatus,
  string
> = {
  accrued: "Owed to you",
  invoiced: "Invoiced",
  paid: "Paid",
};

export const PARTNER_PAYOUT_STATUS_LABELS: Record<PartnerPayoutStatus, string> =
  {
    requested: "Requested",
    paid: "Paid",
  };

export const OFFER_PRESENTATION_MODE_LABELS: Record<
  OfferPresentationMode,
  string
> = {
  all_in: "All-in (one total)",
  itemized: "Itemized (products + service)",
  products_only: "Products only",
};

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  individual: "Individual / Freelancer",
  facility: "Private Facility",
  government: "Government",
};

export const USER_TYPE_LABELS: Record<UserType, string> = {
  individual: "Individual / Freelancer",
  facility: "Private Facility",
  government: "Government",
};

export const GOVERNMENT_REQUEST_STATUS_LABELS: Record<
  GovernmentRequestStatus,
  string
> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const BUSINESS_LINE_LABELS: Record<BusinessLine, string> = {
  consumer: "Consumer",
  smb_sme_channels: "SMB & SME Channels",
  smb_sme_projects: "SMB & SME Projects",
  enterprise: "Enterprise",
};

export const SPECIFICATION_TYPE_LABELS: Record<SpecificationType, string> = {
  number: "Number",
  single_select: "Single-select",
  multi_select: "Multi-select",
  boolean: "Yes / No",
};

export const ASSIGNMENT_SCOPE_LABELS: Record<AssignmentScope, string> = {
  branch: "Branch-wide",
  leaf: "Leaf only",
};

export const ASSIGNMENT_AUDIENCE_LABELS: Record<AssignmentAudience, string> = {
  everyone: "Everyone",
  user: "Users only",
  partner: "Partner users only",
  staff: "Staff only (never shown to shoppers)",
};
