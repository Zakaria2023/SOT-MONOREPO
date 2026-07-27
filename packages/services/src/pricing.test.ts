import { describe, expect, it } from "vitest";
import { PARTNER_DISCOUNT_PERCENT, computePartnerCartPricing } from "./pricing";

describe("computePartnerCartPricing", () => {
  it("takes the partner percent off a whole subtotal", () => {
    const pricing = computePartnerCartPricing(100);
    expect(pricing.discountPercent).toBe(PARTNER_DISCOUNT_PERCENT);
    expect(pricing.discountAmount).toBe(12);
    expect(pricing.total).toBe(88);
  });

  it("echoes the subtotal it was given", () => {
    expect(computePartnerCartPricing(4200.55).subtotal).toBe(4200.55);
  });

  it("rounds the discount to the halala", () => {
    // 12% of 4200.55 is 504.066 exactly
    expect(computePartnerCartPricing(4200.55).discountAmount).toBe(504.07);
    expect(computePartnerCartPricing(4200.55).total).toBe(3696.48);
  });

  // The bug this guards: `total` was `subtotal - discountAmount` on raw
  // floats, so 1234.56 produced 1086.4099999999999 and 0.10 produced
  // 0.09000000000000001 — float noise rendered straight into a cart total.
  it("keeps the total free of floating-point drift", () => {
    expect(computePartnerCartPricing(1234.56).total).toBe(1086.41);
    expect(computePartnerCartPricing(0.1).total).toBe(0.09);
    expect(computePartnerCartPricing(999.99).total).toBe(879.99);
  });

  it("always splits the subtotal exactly: discount + total === subtotal", () => {
    for (const subtotal of [
      0.05, 0.1, 100, 999.99, 1234.56, 4200.55, 87654.32,
    ]) {
      const { discountAmount, total } = computePartnerCartPricing(subtotal);
      // Compared in minor units — the caller's invariant, not float equality.
      expect(Math.round((discountAmount + total) * 100)).toBe(
        Math.round(subtotal * 100),
      );
    }
  });

  it("returns zeros for an empty cart", () => {
    expect(computePartnerCartPricing(0)).toEqual({
      subtotal: 0,
      discountPercent: PARTNER_DISCOUNT_PERCENT,
      discountAmount: 0,
      total: 0,
    });
  });
});
