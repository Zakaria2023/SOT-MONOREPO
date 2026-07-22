import { applyPercentDiscount, fromMinorUnits, toMinorUnits } from "utils";

// The partner discount off MSRP — both the partner's buy-in discount and the
// margin pool (one number, no ladder). What a partner does is captured by their
// capabilities, so every partner prices at this System Integrator rate. Set by
// SOT and adjustable in Phase 1; lives here in code (not an admin table) until
// pricing needs to move at runtime.
export const PARTNER_DISCOUNT_PERCENT = 12;

export type PartnerCartPricing = {
  // Cart totals at MSRP; the discount is presented as ONE lump sum at the cart,
  // never per line — a leaked total reveals no per-item partner price.
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
};

// Given a partner's MSRP subtotal, compute the cart-level lump-sum discount and
// their real total. Fees (delivery/pickup) are layered on by the caller, not
// here.
export const computePartnerCartPricing = (
  subtotalMsrp: number,
): PartnerCartPricing => {
  // Runs through the same integer minor-unit helper the cart and orders use,
  // so `discountAmount + total` is exactly `subtotal`. Subtracting a rounded
  // discount from a float subtotal used to leave drift (0.10 -> 0.09000000001).
  const total = applyPercentDiscount(subtotalMsrp, PARTNER_DISCOUNT_PERCENT);
  const discountAmount = fromMinorUnits(
    toMinorUnits(subtotalMsrp) - toMinorUnits(total),
  );
  return {
    subtotal: subtotalMsrp,
    discountPercent: PARTNER_DISCOUNT_PERCENT,
    discountAmount,
    total,
  };
};
