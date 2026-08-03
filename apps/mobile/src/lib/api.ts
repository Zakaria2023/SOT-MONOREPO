import { API_URL } from "./env";
import type {
  AuthUser,
  Boq,
  Brand,
  CartLineItem,
  Category,
  DesignCheckResult,
  Offer,
  Order,
  PartnerRequestInput,
  Product,
  ProductComparison,
  ProductDetail,
  ProjectAnswers,
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

/**
 * Called once, from the root layout, with Clerk's signOut.
 *
 * Registered centrally rather than handled per screen: a rejected session is
 * not a failure the caller can do anything about, and offering "Try again" on
 * a dead token invites exactly the retry storm this app already hit. Seven
 * screens make authenticated calls; each one wiring its own 401 branch would be
 * seven chances to forget.
 */
let onUnauthorized: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

const SESSION_EXPIRED = "Your session has expired. Please sign in again.";

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
    // 401 means the token is gone or rejected. Sign out so the auth gate moves
    // the user to the sign-in screen, and report it as a settled state rather
    // than something to retry.
    if (response.status === 401) {
      onUnauthorized?.();
      throw new ApiError(401, SESSION_EXPIRED);
    }
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
  // Answers to the questions a previous check asked for. Sent back so the rules
  // that were waiting on them actually run.
  variables?: ProjectAnswers,
): Promise<DesignCheckResult> =>
  request<DesignCheckResult>("/design-check", {
    method: "POST",
    body: { selection, variables },
  });

/**
 * This product beside its comparables, as one table.
 *
 * The rows come from the same service the web compare table uses, already
 * formatted and audience-filtered, so the app holds no copy of the attribute
 * library and the two surfaces cannot compare different things.
 */
export const fetchProductComparison = (
  uuid: string,
  token?: string,
): Promise<ProductComparison> =>
  request<ProductComparison>(`/products/${uuid}/compare`, { token });

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

// ---- Checkout ----
//
// Two destinations, exactly as on the web: a SOLUTION (a whole category added at
// once) becomes a draft BOQ our team quotes, while standalone PRODUCTS become an
// order the buyer pays for. The purchase gate runs server-side inside both, so a
// design the cart showed as blocked cannot be ordered by calling this directly.

export const createBoq = (
  input: { categoryUuid: string; projectInputs?: ProjectAnswers },
  token: string,
): Promise<Boq> =>
  request<Boq>("/boqs", { method: "POST", token, body: input });

export const createOrder = (
  input: { projectInputs?: ProjectAnswers },
  token: string,
): Promise<Order> =>
  request<Order>("/orders", { method: "POST", token, body: input });

export const fetchOrders = (token: string): Promise<Order[]> =>
  request<Order[]>("/orders", { token });

export const fetchBoqs = (token: string): Promise<Boq[]> =>
  request<Boq[]>("/boqs", { token });

// ---- Partner request (public) ----

export const createPartnerRequest = (
  input: PartnerRequestInput,
): Promise<{ uuid: string }> =>
  request<{ uuid: string }>("/partner-requests", {
    method: "POST",
    body: input,
  });

/**
 * URL for a document id, for use as an <Image source>.
 *
 * The API returns image fields as bare document ids — `image: "c73a19ed-..."` —
 * because that is what the column holds. Passing one straight to expo-image, as
 * every screen here did, asks it to load a uuid: not a URL, nothing fetched, no
 * error, just an empty frame. Mobile images had never rendered.
 *
 * The endpoint 302s to a short-lived presigned R2 URL, which expo-image follows.
 */
export const documentUrl = (documentId: string): string =>
  `${API_URL}/api/v1/documents/${documentId}/download`;
