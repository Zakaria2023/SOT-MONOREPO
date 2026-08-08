"use server";

import { requirePartner } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  cartDestinations,
  checkDesign,
  createBoqFromCart,
  createOrderFromCart,
  getCart,
  getPartnerPricingForClerkUser,
  getUserByClerkId,
  type CartLineItem,
  type CartViewer,
  type DestinationOffer,
} from "services";
import { fail, type ActionResult } from "utils";
import { PARTNER_CAPABILITY_LABELS } from "validators";

// P5 — the partner's cart, which did not exist.
//
// The partner app had BOQs and earnings and no way to assemble anything. Every
// destination here goes through the same service the customer cart uses; what
// differs is who the viewer is, and that is exactly what decides where a basket
// may go.

export type PartnerCartView = {
  lines: CartLineItem[];
  destinations: DestinationOffer[];
  discountPercent: number;
  capabilities: string[];
};

const viewerFor = async (
  clerkUserId: string,
): Promise<{ userUuid: string; viewer: CartViewer; discountPercent: number }> => {
  const user = await getUserByClerkId(clerkUserId);
  if (!user) {
    throw new Error("No profile is linked to this account.");
  }
  const pricing = await getPartnerPricingForClerkUser(clerkUserId);
  return {
    userUuid: user.uuid,
    viewer: {
      isPartner: pricing.isPartner,
      capabilities: pricing.capabilities,
    },
    discountPercent: pricing.discountPercent,
  };
};

/**
 * The cart, and where it may go.
 *
 * The destinations are computed from the SAME check the buttons will be
 * validated against on submit, so a partner is never offered something the
 * server would then refuse.
 */
export const getPartnerCartAction = async (): Promise<PartnerCartView> => {
  const clerkUser = await requirePartner();
  const { userUuid, viewer, discountPercent } = await viewerFor(clerkUser.id);

  const lines = (await getCart(userUuid)).filter(
    (line) => line.kind === "product",
  );

  // One design check, feeding the destination rules. Asking twice would let the
  // buttons and the verdict disagree by a render.
  const check = await checkDesign({
    selection: lines.map((line) => ({
      productUuid: line.productUuid,
      quantity: line.quantity,
    })),
  });

  return {
    lines,
    destinations: cartDestinations({
      viewer,
      lineCount: lines.length,
      hasBlockers: check.blockers.length > 0,
      hasUnpricedLines: lines.some(
        (line) => line.unitPrice === null || line.unitPrice === "",
      ),
    }),
    discountPercent,
    capabilities: viewer.capabilities.map(
      (capability) => PARTNER_CAPABILITY_LABELS[capability],
    ),
  };
};

/** Buy it as stock. Refused server-side without the capability to hold any. */
export const orderAsStockAction = async (): Promise<ActionResult> => {
  const clerkUser = await requirePartner();
  try {
    const { userUuid, viewer, discountPercent } = await viewerFor(clerkUser.id);
    await createOrderFromCart({ userUuid, discountPercent, viewer });
    revalidatePath("/cart");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to place that order");
  }
};

/** Hand the design to SOT to be quoted and built. */
export const sendAsBoqAction = async (
  categoryUuid: string,
): Promise<ActionResult> => {
  const clerkUser = await requirePartner();
  try {
    const { userUuid } = await viewerFor(clerkUser.id);
    await createBoqFromCart(userUuid, categoryUuid);
    revalidatePath("/cart");
    revalidatePath("/boqs");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to send that BOQ");
  }
};
