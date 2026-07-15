import { PartnerServiceScope } from "../packages/validators/src/partner";
import {
  BusinessLine,
  BoqStatus,
  GovernmentRequestStatus,
  OfferStatus,
  PartnerRequestStatus,
  PartnerType,
  ProductStatus,
  RuleComparator,
  RuleKind,
  RuleSeverity,
  SpecValueType,
  UserType,
  VendorStatus,
} from "./enum";

export const SPEC_VALUE_TYPE_LABELS: Record<SpecValueType, string> = {
  select: "Dropdown",
  number: "Number",
};

export const RULE_KIND_LABELS: Record<RuleKind, string> = {
  sum_budget: "Sum vs budget",
  count_limit: "Count vs limit",
  per_item_threshold: "Per-item threshold",
};

export const RULE_COMPARATOR_LABELS: Record<RuleComparator, string> = {
  lte: "must be ≤",
  gte: "must be ≥",
  eq: "must be =",
};

export const RULE_SEVERITY_LABELS: Record<RuleSeverity, string> = {
  block: "Block",
  warn: "Warn",
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
  submitted: "Submitted",
  reviewed: "Reviewed",
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

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

export const BUSINESS_LINE_LABELS: Record<BusinessLine, string> = {
  consumer: "Consumer",
  smb_sme_channels: "SMB & SME Channels",
  smb_sme_projects: "SMB & SME Projects",
  enterprise: "Enterprise",
};
