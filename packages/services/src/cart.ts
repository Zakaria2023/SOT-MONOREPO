import { and, asc, eq, sum } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
import { CartItems, Carts, SelectCartItems } from "../../../db/schema/carts";
import { Categories, SelectCategories } from "../../../db/schema/categories";
import { Products, SelectProducts } from "../../../db/schema/products";
import { type DbExecutor } from "./partners";

export type AddToCartInput = {
  userUuid: string;
  productUuid: string;
  quantity?: number;
};

export type CartLineItem = {
  uuid: SelectCartItems["uuid"];
  productUuid: SelectCartItems["productUuid"];
  name: SelectProducts["name"];
  categoryName: SelectCategories["name"] | null;
  image: SelectProducts["image"];
  unitPrice: SelectProducts["price"];
  currency: SelectProducts["currency"];
  quantity: SelectCartItems["quantity"];
};

// Get a user's cart with cart items
export const getCart = async (userUuid: string): Promise<CartLineItem[]> => {
  const [cart] = await db
    .select({ uuid: Carts.uuid })
    .from(Carts)
    .where(eq(Carts.userUuid, userUuid));

  if (!cart) {
    return [];
  }

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

// cart item exist AND belong to this user? If so, give me its internal
const findOwnedCartItemId = async (
  userUuid: string,
  cartItemUuid: string,
): Promise<number | null> => {
  const [item] = await db
    .select({ id: CartItems.id })
    .from(CartItems)
    .innerJoin(Carts, eq(CartItems.cartUuid, Carts.uuid))
    .where(and(eq(CartItems.uuid, cartItemUuid), eq(Carts.userUuid, userUuid)));
  return item?.id ?? null;
};

// update cart item quantity for this user and cart item
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

// remove cart item for this user and cart item
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

// Get a user's cart item count
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

// Return the user's cart uuid, creating the cart first if it doesn't exist.
const getOrCreateCartUuid = async (
  userUuid: string,
  executor: DbExecutor = db,
): Promise<string> => {
  const [existing] = await executor
    .select({ uuid: Carts.uuid })
    .from(Carts)
    .where(eq(Carts.userUuid, userUuid));
  if (existing) {
    return existing.uuid;
  }

  const uuid = randomUUID();
  await executor.insert(Carts).values({ uuid, userUuid });
  return uuid;
};

export const addToCart = async ({
  userUuid,
  productUuid,
  quantity = 1,
}: AddToCartInput): Promise<SelectCartItems> => {
  if (quantity < 1) {
    throw new Error("Quantity must be at least 1");
  }

  return db.transaction(async (tx) => {
    const [product] = await tx
      .select({ uuid: Products.uuid })
      .from(Products)
      .where(eq(Products.uuid, productUuid));
    if (!product) {
      throw new Error("Product not found");
    }

    const cartUuid = await getOrCreateCartUuid(userUuid, tx);

    const [existingItem] = await tx
      .select()
      .from(CartItems)
      .where(
        and(
          eq(CartItems.cartUuid, cartUuid),
          eq(CartItems.productUuid, productUuid),
        ),
      );

    if (existingItem) {
      await tx
        .update(CartItems)
        .set({ quantity: existingItem.quantity + quantity })
        .where(eq(CartItems.id, existingItem.id));

      const [updated] = await tx
        .select()
        .from(CartItems)
        .where(eq(CartItems.id, existingItem.id));
      if (!updated) {
        throw new Error("Failed to update cart item");
      }
      return updated;
    }

    const itemUuid = randomUUID();
    await tx.insert(CartItems).values({
      uuid: itemUuid,
      cartUuid,
      productUuid,
      quantity,
    });

    const [item] = await tx
      .select()
      .from(CartItems)
      .where(eq(CartItems.uuid, itemUuid));
    if (!item) {
      throw new Error("Failed to add item to cart");
    }
    return item;
  });
};
