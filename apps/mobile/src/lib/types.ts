// Lightweight DTOs mirroring the JSON that apps/api returns. The mobile app can
// never import `packages/services` (that's server-only code that opens the DB),
// so these are hand-kept in shape with the service return types the routes emit.
// Money columns (`price`, `unitPrice`) arrive as decimal strings over JSON.

export type Product = {
  uuid: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  image: string | null;
  images: string[] | null;
  price: string | null;
  currency: string | null;
  categoryUuid: string | null;
  categoryName: string | null;
  brandName: string | null;
};

export type ProductDetail = Product & {
  category: Category | null;
  brandBusinessLines: string[] | null;
};

export type Category = {
  uuid: string;
  name: string;
  slug: string;
  image: string | null;
  parentUuid: string | null;
  parentName: string | null;
  productCount: number;
};

export type CartLineItem = {
  uuid: string;
  productUuid: string;
  name: string;
  categoryUuid: string | null;
  categoryName: string | null;
  image: string | null;
  unitPrice: string | null;
  currency: string | null;
  quantity: number;
  kind: string;
};

export type Brand = {
  uuid: string;
  name: string;
  code: string | null;
  description: string | null;
  image: string | null;
  businessLines: string[] | null;
  // Present on the list endpoint, absent on the single-brand endpoint.
  parentName?: string | null;
  productCount?: number;
};

export type Offer = {
  uuid: string;
  boqUuid: string;
  boqReference: string | null;
  productPrice: string | null;
  installPrice: string | null;
  description: string | null;
  status: string;
  createdAt: string;
};

export type AuthUser = {
  uuid: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  company: string | null;
};

// The mobile app implements the individual-applicant path of the partner
// request (the API also accepts facility/government, handled on the web client).
export type PartnerCapability =
  | "system_integrator"
  | "stock"
  | "install_program"
  | "install_only"
  | "pre_sell"
  | "post_sell";

export type PartnerRequestInput = {
  capabilities: PartnerCapability[];
  type: "individual";
  email: string;
  location: string;
  firstName: string;
  lastName: string;
  contactNumber?: string;
};
