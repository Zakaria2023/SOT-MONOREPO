import { PartnerBadge } from "../../../db/enum";

// The System Integrator discount off MSRP — both the partner's buy-in discount
// and the margin pool. Set by SOT and adjustable in Phase 1; lives here in code
// (not an admin table) until pricing needs to move at runtime.
export const BADGE_DISCOUNTS: Record<PartnerBadge, number> = {
  system_integrator: 12,
};

export const discountPercentForBadge = (badge: PartnerBadge): number =>
  BADGE_DISCOUNTS[badge];

export type PartnerCartPricing = {
  // Cart totals at MSRP; the discount is presented as ONE lump sum at the cart,
  // never per line — a leaked total reveals no per-item partner price.
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
};

// Given a partner's MSRP subtotal and badge, compute the cart-level lump-sum
// discount and their real total. Fees (delivery/pickup) are layered on by the
// caller, not here.
export const computePartnerCartPricing = (
  subtotalMsrp: number,
  badge: PartnerBadge,
): PartnerCartPricing => {
  const discountPercent = discountPercentForBadge(badge);
  const discountAmount = Math.round(subtotalMsrp * discountPercent) / 100;
  return {
    subtotal: subtotalMsrp,
    discountPercent,
    discountAmount,
    total: subtotalMsrp - discountAmount,
  };
};
