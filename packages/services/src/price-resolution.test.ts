import { describe, expect, it } from "vitest";
import {
  describeUnpriced,
  resolvePricing,
  type PriceableLine,
} from "./price-resolution";

const AT = new Date("2026-08-08T00:00:00Z");

const line = (over: Partial<PriceableLine> = {}): PriceableLine => ({
  productUuid: "p1",
  name: "A camera",
  price: "100.00",
  currency: "SAR",
  quantity: 1,
  ...over,
});

const resolve = (lines: PriceableLine[], discountPercent = 0) =>
  resolvePricing({ lines, discountPercent, asOf: AT });

describe("resolvePricing", () => {
  it("prices a straightforward line", () => {
    const result = resolve([line({ quantity: 3 })]);
    expect(result.lines[0].listUnit).toBe(100);
    expect(result.lines[0].listTotal).toBe(300);
    expect(result.listSubtotal).toBe(300);
    expect(result.complete).toBe(true);
  });

  it("REFUSES to price a product with no price, rather than calling it free", () => {
    // The whole reason this module exists. toMinorUnits(null) is 0, so the old
    // path wrote an order line at 0.00 and the product shipped for nothing.
    const result = resolve([line({ price: null })]);
    expect(result.lines).toEqual([]);
    expect(result.unpriced).toEqual([
      { productUuid: "p1", name: "A camera", quantity: 1, reason: "no_price" },
    ]);
    expect(result.listSubtotal).toBe(0);
    expect(result.complete).toBe(false);
  });

  it("treats an empty string the same as no price", () => {
    expect(resolve([line({ price: "" })]).complete).toBe(false);
  });

  it("still prices the lines it can, while refusing the ones it cannot", () => {
    const result = resolve([
      line({ productUuid: "p1", price: "100.00" }),
      line({ productUuid: "p2", name: "A switch", price: null }),
    ]);
    expect(result.lines).toHaveLength(1);
    expect(result.unpriced).toHaveLength(1);
    expect(result.listSubtotal).toBe(100);
    // The subtotal is real, and `complete` is what says it is not the whole bill.
    expect(result.complete).toBe(false);
  });

  it("refuses a line in another currency instead of adding it anyway", () => {
    // There is no exchange rate in this system. 100 SAR + 100 USD is 200 of
    // nothing, and taking the first line's currency is how that goes unnoticed.
    const result = resolve([
      line({ productUuid: "p1", price: "100.00", currency: "SAR" }),
      line({ productUuid: "p2", name: "Imported", price: "100.00", currency: "USD" }),
    ]);
    expect(result.currency).toBe("SAR");
    expect(result.listSubtotal).toBe(100);
    expect(result.unpriced[0].reason).toBe("wrong_currency");
  });

  it("applies the discount once, to the subtotal, and never per line", () => {
    const result = resolve([line({ price: "100.00", quantity: 2 })], 12);
    expect(result.listSubtotal).toBe(200);
    expect(result.discountPercent).toBe(12);
    expect(result.discountAmount).toBe(24);
    expect(result.netSubtotal).toBe(176);
    // A per-line net price is the partner's buy-in price. The type does not
    // carry one, so no surface can leak it.
    expect(result.lines[0]).not.toHaveProperty("netUnit");
  });

  it("keeps discount + net exactly equal to the subtotal", () => {
    for (const price of ["4200.55", "1234.56", "0.10", "999.99"]) {
      const result = resolve([line({ price })], 12);
      expect(result.discountAmount + result.netSubtotal).toBeCloseTo(
        result.listSubtotal,
        10,
      );
    }
  });

  it("clamps a nonsensical discount rather than paying the buyer", () => {
    expect(resolve([line()], 150).netSubtotal).toBe(0);
    expect(resolve([line()], -20).discountPercent).toBe(0);
  });

  it("is complete and empty for an empty selection", () => {
    const result = resolve([]);
    expect(result.complete).toBe(true);
    expect(result.listSubtotal).toBe(0);
  });

  it("records the instant it priced at", () => {
    expect(resolve([line()]).asOf).toBe(AT);
  });

  it("falls back to the first PRICED line for the currency", () => {
    // An unpriced line has no currency worth trusting, so it must not decide
    // what the rest of the basket is denominated in.
    const result = resolve([
      line({ productUuid: "p0", price: null, currency: "USD" }),
      line({ productUuid: "p1", price: "50.00", currency: "SAR" }),
    ]);
    expect(result.currency).toBe("SAR");
  });
});

describe("describeUnpriced", () => {
  it("says nothing when everything priced", () => {
    expect(describeUnpriced([])).toBe("");
  });

  it("names the products with no price", () => {
    expect(
      describeUnpriced([
        { productUuid: "p1", name: "A camera", quantity: 1, reason: "no_price" },
      ]),
    ).toBe("A camera has no price");
  });

  it("reads correctly for several", () => {
    expect(
      describeUnpriced([
        { productUuid: "p1", name: "A camera", quantity: 1, reason: "no_price" },
        { productUuid: "p2", name: "A switch", quantity: 1, reason: "no_price" },
      ]),
    ).toBe("A camera, A switch have no price");
  });

  it("keeps the two reasons apart", () => {
    const sentence = describeUnpriced([
      { productUuid: "p1", name: "A camera", quantity: 1, reason: "no_price" },
      { productUuid: "p2", name: "Imported", quantity: 1, reason: "wrong_currency" },
    ]);
    expect(sentence).toBe(
      "A camera has no price; Imported is priced in another currency",
    );
  });
});
