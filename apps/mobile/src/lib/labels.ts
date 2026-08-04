/**
 * Display labels for enum columns the API returns raw.
 *
 * Mirrors db/label.ts. The app cannot import it — that file lives beside the
 * schema, which is server-only — so it is copied here the same way the web client
 * copies it, and for the same reason. Anything that must not drift belongs in the
 * API response instead.
 */
export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  in_stock: "In Stock",
  out_of_stock: "Out of Stock",
  limited_stock: "Limited Stock",
  pre_order: "Pre Order",
  in_order: "In Order",
  end_of_sale: "End of Sale (EOS)",
  end_of_life: "End of Life (EOL)",
};
