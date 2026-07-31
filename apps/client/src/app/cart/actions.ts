"use server";

import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addToCart,
  checkDesign,
  createBoqFromCart,
  createOrderFromCart,
  getCartPreview,
  getPartnerPricingForClerkUser,
  isProfileComplete,
  removeCartItem,
  updateCartItemQuantity,
  type CartLineItem,
  type DesignCheckResult as ServiceDesignCheckResult,
  type DesignFinding as ServiceDesignFinding,
  type DesignQuestion as ServiceDesignQuestion,
  type GuestCartItem,
  type SelectionInput,
} from "services";
import { readProjectAnswers, type ProjectAnswersInput } from "validators";

export type AddToCartResult = {
  error?: string;
};

// Adds a product to the signed-in user's server cart. Guests add to their local
// (browser) cart instead — see lib/guest-cart — and it's merged in on sign-in.
export const addProductToCart = async (
  productUuid: string,
): Promise<AddToCartResult> => {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not signed in" };
  }

  try {
    await addToCart({ userUuid: user.uuid, productUuid });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to add to cart",
    };
  }

  revalidatePath("/");
  return {};
};

// Hydrates a guest's local cart items into full line items for display.
export const previewGuestCart = async (
  items: GuestCartItem[],
): Promise<CartLineItem[]> => getCartPreview(items);

// Moves a guest's local cart into their server cart after they sign in.
export const mergeGuestCart = async (
  items: GuestCartItem[],
): Promise<void> => {
  const user = await getCurrentUser();
  if (!user || items.length === 0) {
    return;
  }

  for (const item of items) {
    try {
      await addToCart({
        userUuid: user.uuid,
        productUuid: item.productUuid,
        quantity: item.quantity,
      });
    } catch {
      // Skip products that no longer exist; merge the rest.
    }
  }

  revalidatePath("/");
};

export const updateQuantity = async (cartItemUuid: string, quantity: number) => {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  await updateCartItemQuantity({ userUuid: user.uuid, cartItemUuid, quantity });
};

export const removeItem = async (cartItemUuid: string) => {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  await removeCartItem({ userUuid: user.uuid, cartItemUuid });
};

// Re-exported so the cart's components keep importing these from here; the
// check itself lives in packages/services because the mobile API runs it too.
export type DesignFinding = ServiceDesignFinding;
export type DesignCheckResult = ServiceDesignCheckResult;
export type DesignQuestion = ServiceDesignQuestion;

export const checkCartDesign = async (
  selection: SelectionInput[],
  // What the buyer has answered so far. The result names the questions still
  // worth asking, so the cart can ask them and re-check with the answers.
  variables?: ProjectAnswersInput,
): Promise<DesignCheckResult> => checkDesign({ selection, variables });

// Checkout turns one solution in the cart into a draft BOQ. The category comes
// from a hidden field on the solution's checkout form. The draft lands in the
// admin dashboard, where an admin assigns a pre-seller to edit and submit it.
export const checkout = async (formData: FormData) => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  // Server-side guard: a profile must be complete before checkout, even if the
  // client-side gate was bypassed.
  if (!isProfileComplete(user)) {
    redirect("/complete-profile?next=/cart");
  }

  const categoryUuid = formData.get("categoryUuid");
  if (typeof categoryUuid !== "string" || categoryUuid.length === 0) {
    throw new Error("Missing solution to check out");
  }

  // The answers travel with the BOQ. A pre-seller validates it later, and a
  // requirement the buyer excused in the cart has to stay excused there.
  const boq = await createBoqFromCart(
    user.uuid,
    categoryUuid,
    readProjectAnswers(formData.get("projectInputs")),
  );
  redirect(`/boq/${boq.uuid}`);
};

// Direct checkout: turn the individual "product" items in the cart into an order
// (no BOQ), applying the partner discount for partners. Lands on the order page,
// where the (stubbed) payment is taken.
export const checkoutProducts = async (formData: FormData) => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  if (!isProfileComplete(user)) {
    redirect("/complete-profile?next=/cart");
  }

  const { discountPercent } = await getPartnerPricingForClerkUser(
    user.clerkUserId,
  );
  const order = await createOrderFromCart({
    userUuid: user.uuid,
    discountPercent,
    // The gate runs again server-side, so it needs the same answers the cart's
    // live check had — otherwise a design the buyer was shown as fine is refused
    // at the last step, on defaults they never saw.
    variables: readProjectAnswers(formData.get("projectInputs")),
  });
  redirect(`/orders/${order.uuid}`);
};
