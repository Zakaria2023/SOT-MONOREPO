// Local copy of the shared `formatPrice` helper. The mobile app runs under
// Metro, which won't transform the workspace `utils` package's raw-TS entry
// point, so cross-app helpers are kept here instead of imported from "utils".
export const formatPrice = (
  price: string | null,
  currency: string | null,
): string =>
  price
    ? `${currency ?? "SAR"} ${Number(price).toLocaleString("en-US")}`
    : "Price on request";
