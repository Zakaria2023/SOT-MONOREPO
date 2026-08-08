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
  // Catalogue identity and lifecycle, all straight off the product row. The web
  // product page shows the same five under "Product details".
  sku: string | null;
  model: string | null;
  status: string | null;
  warrantyPeriod: string | null;
  countryOfOrigin: string | null;
  datasheet: string | null;
  category: Category | null;
  brandBusinessLines: string[] | null;
  // Raw values the API decided this viewer may read — already filtered by
  // audience, so a partner-only attribute simply is not here. Keyed by attribute
  // uuid and typed.
  specValues: Record<string, number | boolean | string | string[]> | null;
  // Label + already-FORMATTED value per attribute, so the app renders a spec
  // table without carrying its own copy of the attribute library, its option
  // labels, or its units.
  specs: ProductSpec[] | null;
};

/** The orders `getProducts` understands, mirrored from the service's ProductSort. */
export type ProductSort = "featured" | "price-asc" | "price-desc" | "name";

/** Bounds for a numeric facet. Either end may be left open. */
export type SpecRange = {
  min?: number;
  max?: number;
};

export type ProductSpec = {
  uuid: string;
  label: string;
  value: string;
  groupName: string | null;
};

// A filter a category offers this viewer. `options` is already the category's
// enabled slice; `ordered` means the choice reads as a ceiling ("what you
// have") rather than an exact match.
export type SpecFacet = {
  key: string;
  label: string;
  // A "number" facet is a range with no options to tick — the app renders two
  // bounds for it. Every other type is a list of values.
  type: string;
  unit: string | null;
  ordered: boolean;
  options: { value: string; label: string; rank: number | null }[];
};

// One thing wrong with a design, from either engine.
export type DesignFinding = {
  id: string;
  title: string;
  message: string;
  // "unknown" is a check that could not be run — missing product data, or a
  // project question the buyer has not answered. Surfaced, never treated as a
  // pass: a check we could not run must not look like one that succeeded.
  tone: "block" | "warn" | "unknown";
  // What the check could not read, per product. The message says the same thing
  // in one sentence; the parts are what a list can be built from.
  skipped?: { productUuid: string; name: string; missing: string[] }[];
  corrections: {
    shape: "add_supply" | "reduce_demand" | "swap";
    message: string;
    products: { productUuid: string; name: string; capacity: number }[];
  }[];
  failingProductUuids: string[];
};

// A question about the SITE rather than about a product, which some rule needs an
// answer to before it can run. Only ever the ones the current basket touches.
export type DesignQuestion = {
  uuid: string;
  label: string;
  unit: string | null;
  // `magnitude` collects a number, `toggle` a yes/no. Taken from how the rule
  // uses the input, so the app never needs the variable library.
  kind: "magnitude" | "toggle";
  value: number | boolean | null;
  affects: string[];
};

export type DesignCheckResult = {
  blockers: DesignFinding[];
  warnings: DesignFinding[];
  // Checks that could not run. Same reason the web shows them: a check we could
  // not make must not read as a check that passed.
  unknowns: DesignFinding[];
  // Questions whose answers would change one of the findings above. The engine
  // has always refused to run a rule whose project input was unanswered and said
  // so; these are what makes it answerable.
  questions: DesignQuestion[];
};

// Buyer answers, keyed by question uuid. Numbers and booleans only — the engine
// compares them numerically, and a string "12" would fail rather than match.
export type ProjectAnswers = Record<string, number | boolean>;

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
  // P11. The verdict, already decided by the API. This file mirrors the service
  // types by hand, so a classifier on this side would be a second copy of the
  // rule — and the first thing to drift. The server sends the sentence; this app
  // shows it.
  supply: { state: "available" | "delayed" | "unavailable"; note: string | null };
};

// One column of the compare table plus the rows it shares with the others. The
// cells are already formatted and audience-filtered, by the same renderer that
// produces a spec row — so a value can never read one way here and another there.
export type ComparisonRow = {
  uuid: string;
  label: string;
  groupName: string | null;
  // productUuid → rendered value. A product silent on this row is absent from the
  // map rather than holding a dash, so this screen decides how a gap looks.
  values: Record<string, string>;
};

export type ProductComparison = {
  products: {
    uuid: string;
    name: string;
    image: string | null;
    price: string | null;
    currency: string | null;
    brandName: string | null;
  }[];
  rows: ComparisonRow[];
};

export type Order = {
  uuid: string;
  reference: string;
  status: string | null;
  productTotal: string;
  serviceTotal: string;
  grandTotal: string;
  currency: string | null;
  boqUuid: string | null;
  // Present on the list endpoint (joined), absent on the single order.
  boqReference?: string | null;
  createdAt: string;
};

export type Boq = {
  uuid: string;
  reference: string;
  status: string | null;
  createdAt: string;
};

export type Brand = {
  uuid: string;
  name: string;
  code: string | null;
  description: string | null;
  image: string | null;
  businessLines: string[] | null;
  // Brands nest the same way categories do — a house brand under its maker. The
  // filter needs the link to offer the parent as a whole.
  parentUuid?: string | null;
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
