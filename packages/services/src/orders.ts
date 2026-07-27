import { and, asc, desc, eq, getTableColumns } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  applyPercentDiscount,
  fromMinorUnits,
  toMinorUnits,
} from "utils";
import { db } from "../../../db";
import { Boqs, SelectBoqs } from "../../../db/schema/boqs";
import { CartItems, Carts } from "../../../db/schema/carts";
import { Offers } from "../../../db/schema/offers";
import {
  OrderItems,
  SelectOrderItems,
} from "../../../db/schema/order-items";
import {
  Invoices,
  Orders,
  SelectInvoices,
  SelectOrders,
} from "../../../db/schema/orders";
import { gateSelection } from "./design-check";
import { getCart } from "./cart";
import { ConflictError, ValidationError } from "./errors";

export type { SelectInvoices, SelectOrderItems, SelectOrders };

export type OrderWithInvoice = {
  order: SelectOrders;
  invoice: SelectInvoices;
};

export type UserOrder = SelectOrders & {
  boqReference: SelectBoqs["reference"] | null;
};

// Sum an offer's money fields into product / service / grand totals. install +
// programming are the two labour streams; both may be null.
const totalsFromOffer = (offer: {
  productPrice: string;
  installPrice: string;
  programmingPrice: string | null;
}) => {
  // Integer minor units, like every other total in this file. Adding decimal
  // strings as floats happens to survive toFixed for two or three addends, but
  // it is the wrong tool for money and the codebase already has the right one.
  const productMinor = toMinorUnits(offer.productPrice);
  const serviceMinor =
    toMinorUnits(offer.installPrice) + toMinorUnits(offer.programmingPrice);
  return {
    productTotal: fromMinorUnits(productMinor).toFixed(2),
    serviceTotal: fromMinorUnits(serviceMinor).toFixed(2),
    grandTotal: fromMinorUnits(productMinor + serviceMinor).toFixed(2),
  };
};

/**
 * Confirm-then-pay: turn the customer's SELECTED offer on a BOQ they own into
 * an order (awaiting_payment) and move the BOQ from `offered` to `ordered`.
 * Totals are snapshotted from the offer so they can't drift later. One order
 * per BOQ — confirming again is rejected.
 */
export const createOrderFromSelectedOffer = async ({
  userUuid,
  boqUuid,
}: {
  userUuid: string;
  boqUuid: string;
}): Promise<SelectOrders> => {
  const [boq] = await db
    .select()
    .from(Boqs)
    .where(and(eq(Boqs.uuid, boqUuid), eq(Boqs.userUuid, userUuid)));
  if (!boq) {
    throw new ValidationError("BOQ not found");
  }

  const [existing] = await db
    .select({ uuid: Orders.uuid })
    .from(Orders)
    .where(eq(Orders.boqUuid, boqUuid));
  if (existing) {
    throw new ConflictError("This BOQ has already been ordered");
  }

  const [offer] = await db
    .select()
    .from(Offers)
    .where(and(eq(Offers.boqUuid, boqUuid), eq(Offers.status, "selected")));
  if (!offer) {
    throw new ValidationError("Select an offer before confirming your order");
  }
  if (offer.expiresAt && offer.expiresAt.getTime() < Date.now()) {
    throw new ConflictError("The selected offer has expired");
  }

  const uuid = randomUUID();
  const reference = `ORD-${uuid.slice(0, 8).toUpperCase()}`;
  const totals = totalsFromOffer(offer);

  await db.transaction(async (tx) => {
    await tx.insert(Orders).values({
      uuid,
      reference,
      boqUuid,
      offerUuid: offer.uuid,
      userUuid,
      productTotal: totals.productTotal,
      serviceTotal: totals.serviceTotal,
      grandTotal: totals.grandTotal,
      currency: offer.currency,
    });

    await tx
      .update(Boqs)
      .set({ status: "ordered" })
      .where(and(eq(Boqs.uuid, boqUuid), eq(Boqs.status, "offered")));
  });

  const [order] = await db.select().from(Orders).where(eq(Orders.uuid, uuid));
  if (!order) {
    throw new Error("Failed to create order");
  }
  return order;
};

/**
 * Direct (non-BOQ) order: turn the "product" items in the user's cart into an
 * order (awaiting_payment) with no BOQ/offer. Each line snapshots the price the
 * customer pays — the discounted unit price for a partner — so it can't drift.
 * The ordered product items are cleared from the cart. Solutions stay for BOQ.
 */
export const createOrderFromCart = async ({
  userUuid,
  discountPercent = 0,
  override,
  region,
  variables,
}: {
  userUuid: string;
  discountPercent?: number;
  // A partner may know better than the catalog; an ordinary user has no way to
  // judge whether the engine is wrong, so only a caller that says the actor may
  // override gets one — and the recorded reason is what makes it auditable.
  override?: { allowed: boolean; reason: string };
  region?: string;
  variables?: Record<string, number | boolean>;
}): Promise<SelectOrders> => {
  const items = (await getCart(userUuid)).filter(
    (item) => item.kind === "product",
  );
  if (items.length === 0) {
    throw new ValidationError("Your cart has no products to order");
  }

  // THE GATE. The cart UI shows the design check live, but a check that only
  // lives in the UI is bypassed by any direct API call — and web and mobile
  // would drift. So it runs again HERE, on the server, at the moment the order
  // is created, through the same service both transports use.
  const gate = await gateSelection({
    selection: items.map((item) => ({
      productUuid: item.productUuid,
      quantity: item.quantity,
    })),
    variables,
    region,
    override,
  });
  if (!gate.allowed) {
    throw new ValidationError(
      `This design cannot be ordered yet: ${gate.blockers
        .map((finding) => finding.message)
        .join(" ")}`,
    );
  }

  const currency = items[0].currency ?? "SAR";
  const lines = items.map((item) => {
    const unitPrice = applyPercentDiscount(item.unitPrice, discountPercent);
    const lineTotal = fromMinorUnits(toMinorUnits(unitPrice) * item.quantity);
    return {
      productUuid: item.productUuid,
      name: item.name,
      unitPrice,
      quantity: item.quantity,
      lineTotal,
    };
  });

  const productTotalMinor = lines.reduce(
    (sum, line) => sum + toMinorUnits(line.unitPrice) * line.quantity,
    0,
  );
  const grandTotal = fromMinorUnits(productTotalMinor).toFixed(2);

  const uuid = randomUUID();
  const reference = `ORD-${uuid.slice(0, 8).toUpperCase()}`;

  await db.transaction(async (tx) => {
    await tx.insert(Orders).values({
      uuid,
      reference,
      userUuid,
      discountPercent,
      productTotal: grandTotal,
      serviceTotal: "0.00",
      grandTotal,
      currency,
      // Snapshotted, not re-derived later: a rule edited next month must not
      // silently change what this order was judged against. It is also how we
      // find out which rules are wrong.
      designFindings: [...gate.blockers, ...gate.warnings],
      designOverrideReason: gate.overridden ? (override?.reason ?? null) : null,
    });

    for (const line of lines) {
      await tx.insert(OrderItems).values({
        uuid: randomUUID(),
        orderUuid: uuid,
        productUuid: line.productUuid,
        name: line.name,
        unitPrice: line.unitPrice.toFixed(2),
        quantity: line.quantity,
        lineTotal: line.lineTotal.toFixed(2),
      });
    }

    // Clear the ordered product items; leave solution items for the BOQ path.
    const [cart] = await tx
      .select({ uuid: Carts.uuid })
      .from(Carts)
      .where(eq(Carts.userUuid, userUuid));
    if (cart) {
      await tx
        .delete(CartItems)
        .where(
          and(eq(CartItems.cartUuid, cart.uuid), eq(CartItems.kind, "product")),
        );
    }
  });

  const [order] = await db.select().from(Orders).where(eq(Orders.uuid, uuid));
  if (!order) {
    throw new Error("Failed to create order");
  }
  return order;
};

/** The line items for a direct order, oldest first. */
export const getOrderItems = async (
  orderUuid: string,
): Promise<SelectOrderItems[]> =>
  db
    .select()
    .from(OrderItems)
    .where(eq(OrderItems.orderUuid, orderUuid))
    .orderBy(asc(OrderItems.createdAt));

/**
 * Settle an awaiting-payment order and raise its one invoice. Payment has no
 * live gateway yet, so this is the plumbing a gateway callback (or an admin)
 * will call once a payment succeeds — it does not itself charge anyone.
 */
export const markOrderPaid = async (
  orderUuid: string,
): Promise<OrderWithInvoice> => {
  const [order] = await db
    .select()
    .from(Orders)
    .where(eq(Orders.uuid, orderUuid));
  if (!order) {
    throw new ValidationError("Order not found");
  }
  if (order.status !== "awaiting_payment") {
    throw new ConflictError("This order is not awaiting payment");
  }

  const paidAt = new Date();
  const invoiceUuid = randomUUID();
  const invoiceNumber = `INV-${invoiceUuid.slice(0, 8).toUpperCase()}`;

  await db.transaction(async (tx) => {
    await tx
      .update(Orders)
      .set({ status: "paid", paidAt })
      .where(eq(Orders.uuid, orderUuid));

    await tx.insert(Invoices).values({
      uuid: invoiceUuid,
      number: invoiceNumber,
      orderUuid,
      status: "paid",
      amount: order.grandTotal,
      currency: order.currency,
      paidAt,
    });
  });

  const [updated] = await db
    .select()
    .from(Orders)
    .where(eq(Orders.uuid, orderUuid));
  const [invoice] = await db
    .select()
    .from(Invoices)
    .where(eq(Invoices.uuid, invoiceUuid));
  if (!updated || !invoice) {
    throw new Error("Failed to settle order");
  }
  return { order: updated, invoice };
};

/** Cancel an order that hasn't been paid yet. */
export const cancelOrder = async (orderUuid: string): Promise<SelectOrders> => {
  const [order] = await db
    .select()
    .from(Orders)
    .where(eq(Orders.uuid, orderUuid));
  if (!order) {
    throw new ValidationError("Order not found");
  }
  if (order.status !== "awaiting_payment") {
    throw new ConflictError("Only an unpaid order can be cancelled");
  }

  await db
    .update(Orders)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(Orders.uuid, orderUuid));

  const [updated] = await db
    .select()
    .from(Orders)
    .where(eq(Orders.uuid, orderUuid));
  if (!updated) {
    throw new Error("Failed to cancel order");
  }
  return updated;
};

/** One order the given user owns, or null. */
export const getUserOrder = async (
  userUuid: string,
  orderUuid: string,
): Promise<SelectOrders | null> => {
  const [order] = await db
    .select()
    .from(Orders)
    .where(and(eq(Orders.uuid, orderUuid), eq(Orders.userUuid, userUuid)));
  return order ?? null;
};

/** Every order a user owns, newest first, tagged with its BOQ reference. */
export const getUserOrders = async (
  userUuid: string,
): Promise<UserOrder[]> =>
  db
    .select({
      ...getTableColumns(Orders),
      boqReference: Boqs.reference,
    })
    .from(Orders)
    .leftJoin(Boqs, eq(Orders.boqUuid, Boqs.uuid))
    .where(eq(Orders.userUuid, userUuid))
    .orderBy(desc(Orders.createdAt));

/** The invoice for an order, or null if none has been raised yet. */
export const getInvoiceForOrder = async (
  orderUuid: string,
): Promise<SelectInvoices | null> => {
  const [invoice] = await db
    .select()
    .from(Invoices)
    .where(eq(Invoices.orderUuid, orderUuid));
  return invoice ?? null;
};
