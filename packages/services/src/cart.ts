import { and, asc, eq, sum } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
import {
  CartItems,
  Carts,
  SelectCartItems,
  SelectCarts,
} from "../../../db/schema/carts";
import { Categories } from "../../../db/schema/categories";
import { Products } from "../../../db/schema/products";

export type AddToCartInput = {
  // The authenticated user's uuid. The transport (Server Action / Route
  // Handler) resolves this from the access token before calling in — the
  // cart service itself performs no auth checks.
  userUuid: string;
  productUuid: string;
  quantity?: number;
};

export type CartLineItem = {
  uuid: string; // cart item uuid
  productUuid: string;
  name: string;
  categoryName: string | null;
  image: string | null;
  unitPrice: string;
  currency: string | null;
  quantity: number;
};

/** The user's cart line items with the product details needed to render them. */
export const getCart = async (userUuid: string): Promise<CartLineItem[]> => {
  const [cart] = await db
    .select({ uuid: Carts.uuid })
    .from(Carts)
    .where(eq(Carts.userUuid, userUuid));
  if (!cart) return [];

  return db
    .select({
      uuid: CartItems.uuid,
      productUuid: CartItems.productUuid,
      name: Products.name,
      categoryName: Categories.name,
      image: Products.image,
      unitPrice: Products.price,
      currency: Products.currency,
      quantity: CartItems.quantity,
    })
    .from(CartItems)
    .innerJoin(Products, eq(CartItems.productUuid, Products.uuid))
    .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid))
    .where(eq(CartItems.cartUuid, cart.uuid))
    .orderBy(asc(CartItems.createdAt));
};

// Verifies a cart item belongs to the user's cart, returning its numeric id.
const findOwnedCartItemId = async (
  userUuid: string,
  cartItemUuid: string,
): Promise<number | null> => {
  const [item] = await db
    .select({ id: CartItems.id })
    .from(CartItems)
    .innerJoin(Carts, eq(CartItems.cartUuid, Carts.uuid))
    .where(
      and(eq(CartItems.uuid, cartItemUuid), eq(Carts.userUuid, userUuid)),
    );
  return item?.id ?? null;
};

export const updateCartItemQuantity = async ({
  userUuid,
  cartItemUuid,
  quantity,
}: {
  userUuid: string;
  cartItemUuid: string;
  quantity: number;
}): Promise<void> => {
  if (quantity < 1) throw new Error("Quantity must be at least 1");

  const id = await findOwnedCartItemId(userUuid, cartItemUuid);
  if (id === null) throw new Error("Cart item not found");

  await db.update(CartItems).set({ quantity }).where(eq(CartItems.id, id));
};

export const removeCartItem = async ({
  userUuid,
  cartItemUuid,
}: {
  userUuid: string;
  cartItemUuid: string;
}): Promise<void> => {
  const id = await findOwnedCartItemId(userUuid, cartItemUuid);
  if (id === null) return;

  await db.delete(CartItems).where(eq(CartItems.id, id));
};

/** Total quantity of items in the user's cart (0 if they have no cart yet). */
export const getCartItemCount = async (userUuid: string): Promise<number> => {
  const [cart] = await db
    .select({ uuid: Carts.uuid })
    .from(Carts)
    .where(eq(Carts.userUuid, userUuid));
  if (!cart) return 0;

  const [row] = await db
    .select({ total: sum(CartItems.quantity) })
    .from(CartItems)
    .where(eq(CartItems.cartUuid, cart.uuid));
  return Number(row?.total ?? 0);
};

/** Returns the user's cart, creating it on first use. */
const getOrCreateCart = async (userUuid: string): Promise<SelectCarts> => {
  const [existing] = await db
    .select()
    .from(Carts)
    .where(eq(Carts.userUuid, userUuid));
  if (existing) return existing;

  const uuid = randomUUID();
  await db.insert(Carts).values({ uuid, userUuid });

  const [cart] = await db.select().from(Carts).where(eq(Carts.uuid, uuid));
  if (!cart) throw new Error("Failed to create cart");
  return cart;
};

/**
 * Adds a product to the user's cart. If the product is already in the cart,
 * its quantity is increased; otherwise a new line item is created.
 */
export const addToCart = async ({
  userUuid,
  productUuid,
  quantity = 1,
}: AddToCartInput): Promise<SelectCartItems> => {
  if (quantity < 1) throw new Error("Quantity must be at least 1");

  const [product] = await db
    .select({ uuid: Products.uuid })
    .from(Products)
    .where(eq(Products.uuid, productUuid));
  if (!product) throw new Error("Product not found");

  const cart = await getOrCreateCart(userUuid);

  const [existingItem] = await db
    .select()
    .from(CartItems)
    .where(
      and(
        eq(CartItems.cartUuid, cart.uuid),
        eq(CartItems.productUuid, productUuid),
      ),
    );

  if (existingItem) {
    await db
      .update(CartItems)
      .set({ quantity: existingItem.quantity + quantity })
      .where(eq(CartItems.id, existingItem.id));

    const [updated] = await db
      .select()
      .from(CartItems)
      .where(eq(CartItems.id, existingItem.id));
    if (!updated) throw new Error("Failed to update cart item");
    return updated;
  }

  const itemUuid = randomUUID();
  await db.insert(CartItems).values({
    uuid: itemUuid,
    cartUuid: cart.uuid,
    productUuid,
    quantity,
  });

  const [item] = await db
    .select()
    .from(CartItems)
    .where(eq(CartItems.uuid, itemUuid));
  if (!item) throw new Error("Failed to add item to cart");
  return item;
};
