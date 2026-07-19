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

export type AuthUser = {
  uuid: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  company: string | null;
};
