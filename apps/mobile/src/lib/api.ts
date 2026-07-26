import { API_URL } from "./env";
import type {
  AuthUser,
  Brand,
  CartLineItem,
  Category,
  DesignCheckResult,
  Offer,
  PartnerRequestInput,
  Product,
  ProductDetail,
  SpecFacet,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
};

type ProductsQuery = {
  search?: string;
  categoryUuids?: string[];
  brandUuids?: string[];
  sort?: "featured" | "price-asc" | "price-desc" | "name";
  // Chosen facet values per attribute key. Sent as repeated `spec=key:value`,
  // the same encoding the web catalog uses, so a shared link means the same
  // thing on both.
  specValues?: Record<string, string[]>;
  // Which category the chosen facets belong to. Needed because categoryUuids
  // is usually a whole subtree — the facets are the picked category's, but the
  // products sit in its leaves.
  facetCategoryUuid?: string;
};

const buildQuery = (query: ProductsQuery): string => {
  const params = new URLSearchParams();
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.sort) {
    params.set("sort", query.sort);
  }
  for (const uuid of query.categoryUuids ?? []) {
    params.append("category", uuid);
  }
  for (const uuid of query.brandUuids ?? []) {
    params.append("brand", uuid);
  }
  if (query.facetCategoryUuid) {
    params.set("facets", query.facetCategoryUuid);
  }
  for (const [key, values] of Object.entries(query.specValues ?? {})) {
    for (const value of values) {
      params.append("spec", `${key}:${value}`);
    }
  }
  const qs = params.toString();
  return qs.length > 0 ? `?${qs}` : "";
};

// Pull a human-readable message out of a failed response, whatever its shape.
const extractError = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    if (
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
    ) {
      return (data as { error: string }).error;
    }
  } catch {
    // fall through to the generic message below
  }
  return `Request failed (${response.status})`;
};

const request = async <T>(
  path: string,
  { method = "GET", token, body }: RequestOptions = {},
): Promise<T> => {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await extractError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
};

// ---- Catalog (public) ----

export const fetchProducts = (query: ProductsQuery = {}): Promise<Product[]> =>
  request<Product[]>(`/products${buildQuery(query)}`);

export const fetchProduct = (uuid: string): Promise<ProductDetail> =>
  request<ProductDetail>(`/products/${uuid}`);

export const fetchCategories = (): Promise<Category[]> =>
  request<Category[]>("/categories");

/**
 * The filters this category offers — resolved server-side from the
 * assignments, so the app never needs to know the attribute library, the
 * category tree, or who is allowed to see what. Pass the token when signed in:
 * a partner is offered facets a plain user is not.
 */
export const fetchCategoryFacets = (
  uuid: string,
  token?: string,
): Promise<SpecFacet[]> =>
  request<SpecFacet[]>(`/categories/${uuid}/facets`, { token });

/**
 * Check a basket before the buyer commits to it: missing companions and
 * compatibility conflicts, split into blockers and warnings. Same service
 * behind this as the web cart, so the two cannot disagree about whether a
 * design is valid.
 */
export const fetchDesignCheck = (
  selection: { productUuid: string; quantity: number }[],
): Promise<DesignCheckResult> =>
  request<DesignCheckResult>("/design-check", {
    method: "POST",
    body: { selection },
  });

export const fetchCategory = (uuid: string): Promise<Category> =>
  request<Category>(`/categories/${uuid}`);

export const fetchBrands = (): Promise<Brand[]> =>
  request<Brand[]>("/brands");

export const fetchBrand = (uuid: string): Promise<Brand> =>
  request<Brand>(`/brands/${uuid}`);

// ---- Authenticated ----

export const fetchMe = (token: string): Promise<AuthUser> =>
  request<AuthUser>("/auth/me", { token });

export const fetchOffers = (token: string): Promise<Offer[]> =>
  request<Offer[]>("/offers", { token });

export const fetchCart = (token: string): Promise<CartLineItem[]> =>
  request<CartLineItem[]>("/cart", { token });

export const fetchCartCount = (token: string): Promise<{ count: number }> =>
  request<{ count: number }>("/cart/count", { token });

export const addCartItem = (
  input: { productUuid: string; quantity?: number },
  token: string,
): Promise<CartLineItem> =>
  request<CartLineItem>("/cart/items", {
    method: "POST",
    token,
    body: input,
  });

export const updateCartItem = (
  uuid: string,
  quantity: number,
  token: string,
): Promise<void> =>
  request<void>(`/cart/items/${uuid}`, {
    method: "PATCH",
    token,
    body: { quantity },
  });

export const removeCartItem = (uuid: string, token: string): Promise<void> =>
  request<void>(`/cart/items/${uuid}`, { method: "DELETE", token });

// ---- Partner request (public) ----

export const createPartnerRequest = (
  input: PartnerRequestInput,
): Promise<{ uuid: string }> =>
  request<{ uuid: string }>("/partner-requests", {
    method: "POST",
    body: input,
  });
