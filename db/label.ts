import { PartnerServiceScope } from "../packages/validators/src/partner";
import {
  BoqStatus,
  OfferStatus,
  PartnerRequestStatus,
  ProductStatus,
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
