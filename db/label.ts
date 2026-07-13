import { PartnerServiceScope } from "../packages/validators/src/partner";
import {
  AliasTermType,
  BoqStatus,
  GovernmentRequestStatus,
  OfferStatus,
  PartnerRequestStatus,
  ProductStatus,
  UserType,
} from "./enum";

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
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

export const ALIAS_TERM_TYPE_LABELS: Record<AliasTermType, string> = {
  barcode: "Barcode (EAN/GTIN)",
  manufacturer: "Manufacturer ID",
  vendor_sku: "Vendor SKU",
  model: "Model",
  nickname: "Nickname",
};
