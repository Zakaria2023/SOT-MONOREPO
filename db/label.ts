import { PartnerServiceScope } from "../packages/validators/src/partner";
import {
  AliasTermType,
  BusinessLine,
  BoqStatus,
  GovernmentRequestStatus,
  OfferStatus,
  PartnerRequestStatus,
  ProductStatus,
  UserType,
} from "./enum";

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

export const BUSINESS_LINE_LABELS: Record<BusinessLine, string> = {
  consumer: "Consumer",
  smb_sme_channels: "SMB & SME Channels",
  smb_sme_projects: "SMB & SME Projects",
  enterprise: "Enterprise",
};
