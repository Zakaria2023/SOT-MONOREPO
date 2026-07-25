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
  RuleAllocation,
  RuleComparator,
  RuleKind,
  RuleSeverity,
  SpecificationDomain,
  SpecInputType,
  SpecValueType,
  UserType,
} from "./enum";

export const SPEC_VALUE_TYPE_LABELS: Record<SpecValueType, string> = {
  select: "Dropdown",
  number: "Number",
};

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

export const RULE_KIND_LABELS: Record<RuleKind, string> = {
  sum_budget: "Budget — sum vs capacity",
  count_limit: "Count — items vs slots",
  per_item_threshold: "Match — per-item threshold",
  ratio: "Ratio — demand ÷ supply",
  spec_match: "Match — spec compatibility",
};

export const RULE_COMPARATOR_LABELS: Record<RuleComparator, string> = {
  lte: "must be ≤",
  gte: "must be ≥",
  eq: "must equal",
  in: "must be one of",
  intersects: "must overlap",
};

export const RULE_SEVERITY_LABELS: Record<RuleSeverity, string> = {
  block: "Block",
  warn: "Warn",
};

export const RULE_ALLOCATION_LABELS: Record<RuleAllocation, string> = {
  pooled: "Shared pool",
  per_provider: "Per device",
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

export const SPEC_INPUT_TYPE_LABELS: Record<SpecInputType, string> = {
  number: "Number",
  single_select: "Single-select",
  multi_select: "Multi-select",
  boolean: "Yes / No",
  text: "Text",
};

export const ASSIGNMENT_SCOPE_LABELS: Record<AssignmentScope, string> = {
  branch: "Branch-wide",
  leaf: "Leaf only",
};

export const ASSIGNMENT_AUDIENCE_LABELS: Record<AssignmentAudience, string> = {
  all: "Everyone",
  partner: "Partners & staff",
  staff: "Staff only",
};
