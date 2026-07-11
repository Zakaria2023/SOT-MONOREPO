import { and, asc, eq, sql, sum } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
import { CartItems, Carts, SelectCartItems } from "../../../db/schema/carts";
import { Categories, SelectCategories } from "../../../db/schema/categories";
import { Products, SelectProducts } from "../../../db/schema/products";
import { ValidationError } from "./errors";

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
  kind: SelectCartItems["kind"];
};

// Reject a non-positive quantity before it reaches the database.
const assertValidQuantity = (quantity: number): void => {
  if (quantity < 1) {
    throw new ValidationError("Quantity must be at least 1");
  }
};

// Return every line item in the user's cart, with product and category details.
export const getCart = async (userUuid: string): Promise<CartLineItem[]> =>
  db
    .select({
      uuid: CartItems.uuid,
      productUuid: CartItems.productUuid,
      name: Products.name,
      categoryName: Categories.name,
      image: Products.image,
      unitPrice: Products.price,
      currency: Products.currency,
      quantity: CartItems.quantity,
      kind: CartItems.kind,
    })
    .from(Carts)
    .innerJoin(CartItems, eq(CartItems.cartUuid, Carts.uuid))
    .innerJoin(Products, eq(CartItems.productUuid, Products.uuid))
    .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid))
    .where(eq(Carts.userUuid, userUuid))
    .orderBy(asc(CartItems.createdAt));

// Resolve a cart item's public uuid to its internal id, but only when the item
// belongs to this user (joined through the owning cart). Returns null otherwise.
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

// Set a cart item's quantity; throws if the item isn't in this user's cart.
export const updateCartItemQuantity = async ({
  userUuid,
  cartItemUuid,
  quantity,
}: {
  userUuid: string;
  cartItemUuid: string;
  quantity: number;
}): Promise<void> => {
  assertValidQuantity(quantity);

  const id = await findOwnedCartItemId(userUuid, cartItemUuid);
  if (id === null) {
    throw new ValidationError("Cart item not found");
  }

  await db.update(CartItems).set({ quantity }).where(eq(CartItems.id, id));
};

// Remove a cart item from the user's cart; a no-op if it isn't theirs.
export const removeCartItem = async ({
  userUuid,
  cartItemUuid,
}: {
  userUuid: string;
  cartItemUuid: string;
}): Promise<void> => {
  const id = await findOwnedCartItemId(userUuid, cartItemUuid);
  if (id === null) {
    return;
  }

  await db.delete(CartItems).where(eq(CartItems.id, id));
};

// Total number of units in the user's cart (sum of quantities); 0 if empty.
export const getCartItemCount = async (userUuid: string): Promise<number> => {
  const [row] = await db
    .select({ total: sum(CartItems.quantity) })
    .from(Carts)
    .innerJoin(CartItems, eq(CartItems.cartUuid, Carts.uuid))
    .where(eq(Carts.userUuid, userUuid));
  return Number(row?.total ?? 0);
};

// Return the user's cart uuid, creating the cart first if it doesn't exist.
const getOrCreateCartUuid = async (userUuid: string): Promise<string> => {
  const [existing] = await db
    .select({ uuid: Carts.uuid })
    .from(Carts)
    .where(eq(Carts.userUuid, userUuid));
  if (existing) {
    return existing.uuid;
  }

  const uuid = randomUUID();
  await db.insert(Carts).values({ uuid, userUuid });
  return uuid;
};

// Add a product to the user's cart, creating the cart if needed. Adding a
// product already in the cart bumps its quantity instead of duplicating it.
export const addToCart = async ({
  userUuid,
  productUuid,
  quantity = 1,
}: AddToCartInput): Promise<SelectCartItems> => {
  assertValidQuantity(quantity);

  const [product] = await db
    .select({ uuid: Products.uuid })
    .from(Products)
    .where(eq(Products.uuid, productUuid));
  if (!product) {
    throw new ValidationError("Product not found");
  }

  const cartUuid = await getOrCreateCartUuid(userUuid);

  // One statement instead of select-then-update-or-insert: the unique key on
  // (cart_uuid, product_uuid) turns a repeat add into a quantity bump.
  await db
    .insert(CartItems)
    .values({ uuid: randomUUID(), cartUuid, productUuid, quantity, kind: "product" })
    .onDuplicateKeyUpdate({
      set: { quantity: sql`${CartItems.quantity} + ${quantity}` },
    });

  // No RETURNING on MySQL — read the row back by its unique pair (the row's own
  // uuid differs from the one above when it was an update, not an insert).
  const [item] = await db
    .select()
    .from(CartItems)
    .where(
      and(
        eq(CartItems.cartUuid, cartUuid),
        eq(CartItems.productUuid, productUuid),
      ),
    );
  if (!item) {
    throw new Error("Failed to add item to cart");
  }
  return item;
};

/**
 * Add every product in a category to the user's cart as a "solution" — a
 * missing product is inserted, one already in the cart has its quantity bumped.
 */
export const addCategoryToCart = async (
  userUuid: string,
  categoryUuid: string,
): Promise<void> => {
  const products = await db
    .select({ uuid: Products.uuid })
    .from(Products)
    .where(eq(Products.categoryUuid, categoryUuid));
  if (products.length === 0) {
    throw new ValidationError("This category has no products to add");
  }

  const cartUuid = await getOrCreateCartUuid(userUuid);

  await db.transaction(async (tx) => {
    for (const product of products) {
      await tx
        .insert(CartItems)
        .values({
          uuid: randomUUID(),
          cartUuid,
          productUuid: product.uuid,
          quantity: 1,
          kind: "solution",
        })
        .onDuplicateKeyUpdate({
          set: { quantity: sql`${CartItems.quantity} + 1` },
        });
    }
  });
};
