import { describe, expect, it } from "vitest";
import {
  describeUnpriced,
  priceInForce,
  resolvePricing,
  type DatedPrice,
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

describe("priceInForce", () => {
  const window = (
    from: string,
    to: string | null,
    price = "100.00",
  ): DatedPrice => ({
    price,
    currency: "SAR",
    effectiveFrom: new Date(from),
    effectiveTo: to === null ? null : new Date(to),
  });

  const at = (when: string) => new Date(when);

  it("finds the open window", () => {
    expect(
      priceInForce([window("2026-01-01", null, "50.00")], at("2026-08-08"))
        ?.price,
    ).toBe("50.00");
  });

  it("returns null before any window starts", () => {
    // Not the nearest row. Quoting a price that was not in force is the failure
    // this table exists to prevent.
    expect(
      priceInForce([window("2026-09-01", null)], at("2026-08-08")),
    ).toBeNull();
  });

  it("treats the end of a window as exclusive", () => {
    // A window closing at noon and the next opening at noon must leave neither a
    // gap nor two prices in force at that instant.
    const windows = [
      window("2026-01-01", "2026-06-01", "old"),
      window("2026-06-01", null, "new"),
    ];
    expect(priceInForce(windows, at("2026-06-01"))?.price).toBe("new");
    expect(
      priceInForce(windows, at("2026-05-31T23:59:59Z"))?.price,
    ).toBe("old");
  });

  it("takes the latest start when two windows overlap", () => {
    // Correcting a price is one insert, not a close-then-open pair somebody has
    // to get right under time pressure.
    expect(
      priceInForce(
        [window("2026-01-01", null, "old"), window("2026-07-01", null, "corrected")],
        at("2026-08-08"),
      )?.price,
    ).toBe("corrected");
  });

  it("returns null inside a deliberate gap", () => {
    expect(
      priceInForce(
        [window("2026-01-01", "2026-02-01"), window("2026-09-01", null)],
        at("2026-05-01"),
      ),
    ).toBeNull();
  });

  it("handles no windows at all", () => {
    expect(priceInForce([], at("2026-08-08"))).toBeNull();
  });

  it("prices a past quote at the price that was in force then", () => {
    const windows = [
      window("2026-01-01", "2026-07-01", "100.00"),
      window("2026-07-01", null, "130.00"),
    ];
    expect(priceInForce(windows, at("2026-06-15"))?.price).toBe("100.00");
    expect(priceInForce(windows, at("2026-08-08"))?.price).toBe("130.00");
  });
});
