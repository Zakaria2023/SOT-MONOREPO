import { and, asc, desc, eq, getTableColumns, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { applyPercentDiscount, fromMinorUnits, toMinorUnits } from "utils";
import { db } from "../../../db";
import { Boqs, SelectBoqs } from "../../../db/schema/boqs";
import { CartItems, Carts } from "../../../db/schema/carts";
import { Offers } from "../../../db/schema/offers";
import { OrderItems, SelectOrderItems } from "../../../db/schema/order-items";
import {
  Invoices,
  Orders,
  SelectInvoices,
  SelectOrders,
} from "../../../db/schema/orders";
import type { ProjectAnswers } from "../../../db/types";
import { statusesThatCanBecome } from "./boq-lifecycle";
import { canSendTo, type CartViewer } from "./cart-destinations";
import { gateSelection } from "./design-check";
import { issueInvoice } from "./invoicing";
import { notify } from "./notifications";
import { Users } from "../../../db/schema/users";
import { describeUnpriced, resolvePricing } from "./price-resolution";
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

    // Same rule, same source. Only an offered BOQ becomes ordered, and the
    // lifecycle model is where that is written down.
    await tx
      .update(Boqs)
      .set({ status: "ordered" })
      .where(
        and(
          eq(Boqs.uuid, boqUuid),
          inArray(Boqs.status, statusesThatCanBecome("ordered")),
        ),
      );
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
  viewer,
}: {
  userUuid: string;
  discountPercent?: number;
  // A partner may know better than the catalog; an ordinary user has no way to
  // judge whether the engine is wrong, so only a caller that says the actor may
  // override gets one — and the recorded reason is what makes it auditable.
  override?: { allowed: boolean; reason: string };
  region?: string;
  variables?: ProjectAnswers;
  // Who is buying, for the destination check below. Absent means an ordinary
  // customer, which is what every caller before partner carts was.
  viewer?: CartViewer;
}): Promise<SelectOrders> => {
  const items = (await getCart(userUuid)).filter(
    (item) => item.kind === "product",
  );
  if (items.length === 0) {
    throw new ValidationError("Your cart has no products to order");
  }

  // Checked HERE and not only where the button is drawn. A rule enforced in the
  // UI is bypassed by anything that posts directly — the same reasoning that put
  // the design gate inside this function rather than in the cart screen.
  //
  // Blockers and prices are judged further down by the gate and the resolver, so
  // this pass is about WHO may buy: a partner without the `stock` capability is
  // not approved to hold stock, and nothing consulted that before.
  const destination = canSendTo("order", {
    viewer: viewer ?? { isPartner: false, capabilities: [] },
    lineCount: items.length,
    hasBlockers: false,
    hasUnpricedLines: false,
  });
  if (!destination.allowed) {
    throw new ValidationError(
      destination.reason ?? "This cart cannot be ordered.",
    );
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
    // Naming the unanswered questions matters as much as naming the blockers: a
    // refusal that only says "incompatible" sends the buyer hunting for a fault
    // in the products when the real gap is a question nobody asked them.
    const pending =
      gate.questions.length > 0
        ? ` We also still need: ${gate.questions
            .map((question) => question.label)
            .join(", ")}.`
        : "";
    throw new ValidationError(
      `This design cannot be ordered yet: ${gate.blockers
        .map((finding) => finding.message)
        .join(" ")}${pending}`,
    );
  }

  // THE SECOND GATE, and the one nobody had. `toMinorUnits(null)` is 0, so a
  // product with no price used to become a line at 0.00 — the order completed,
  // the item shipped for nothing, and no surface anywhere could tell that apart
  // from a genuinely free product. Every product in the catalogue is currently
  // unpriced, so this was not a hypothetical.
  //
  // Priced through the same resolver every other surface uses, so the cart, the
  // quote and this refusal can never disagree about what a basket costs.
  const pricing = resolvePricing({
    lines: items.map((item) => ({
      productUuid: item.productUuid,
      name: item.name,
      price: item.unitPrice,
      currency: item.currency,
      quantity: item.quantity,
    })),
    discountPercent,
    asOf: new Date(),
  });

  if (!pricing.complete) {
    throw new ValidationError(
      `This order cannot be placed: ${describeUnpriced(pricing.unpriced)}.`,
    );
  }

  const currency = pricing.currency;

  // The stored line price stays NET, as it always has — an order is a record of
  // what was actually charged. The lump-sum presentation rule governs what a
  // shopper is SHOWN before they buy, not what the invoice says afterwards.
  const lines = pricing.lines.map((line) => {
    const unitPrice = applyPercentDiscount(line.listUnit, discountPercent);
    return {
      productUuid: line.productUuid,
      name: line.name,
      unitPrice,
      quantity: line.quantity,
      lineTotal: fromMinorUnits(toMinorUnits(unitPrice) * line.quantity),
    };
  });

  const grandTotal = fromMinorUnits(
    lines.reduce(
      (sum, line) => sum + toMinorUnits(line.unitPrice) * line.quantity,
      0,
    ),
  ).toFixed(2);

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
      // Unknowns included deliberately: an order judged against a check that
      // could not run is a different fact from one judged clean, and this
      // snapshot is the only place that distinction survives.
      designFindings: [...gate.blockers, ...gate.warnings, ...gate.unknowns],
      // And what those findings were reached on. Null when the rules asked the
      // buyer nothing, which is not the same fact as answering nothing.
      projectInputs:
        variables && Object.keys(variables).length > 0 ? variables : null,
      designOverrideReason: gate.overridden ? (override?.reason ?? null) : null,
    });

    // One multi-row INSERT: checkout latency should track the order, not the
    // number of lines in it.
    await tx.insert(OrderItems).values(
      lines.map((line) => ({
        uuid: randomUUID(),
        orderUuid: uuid,
        productUuid: line.productUuid,
        name: line.name,
        unitPrice: line.unitPrice.toFixed(2),
        quantity: line.quantity,
        lineTotal: line.lineTotal.toFixed(2),
      })),
    );

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
 * Record that cash was received.
 *
 * There is no gateway. Cash is handed to a person, so this is staff attesting
 * that money arrived — never the customer asserting it. The client used to call
 * a simulated payment that waited 1.2 seconds and marked the order paid with
 * nothing having moved; that was a reasonable placeholder for a card flow and is
 * the wrong shape entirely for cash.
 *
 * Which is why it takes who received it. An order marked paid by nobody, against
 * no reference, cannot be reconciled against a till or a bank statement, and
 * "paid" then means only that somebody clicked.
 *
 * The invoice comes from `issueInvoice`, not from here. This function used to
 * mint its own with no VAT breakdown, no seller registration and no QR — a
 * document that is not a tax invoice, under a second numbering scheme.
 */
export const recordCashPayment = async (
  orderUuid: string,
  received: { by: string; reference: string; note?: string | null },
): Promise<OrderWithInvoice> => {
  if (received.reference.trim() === "") {
    throw new ValidationError(
      "Recording a cash payment needs a reference — a receipt number, or the deposit slip.",
    );
  }

  const paidAt = new Date();

  // Read and write under one lock. Two people recording the same cash payment
  // would otherwise both find the order awaiting payment and both settle it.
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(Orders)
      .where(eq(Orders.uuid, orderUuid))
      .for("update");
    if (!order) {
      throw new ValidationError("Order not found");
    }
    if (order.status !== "awaiting_payment") {
      throw new ConflictError("This order is not awaiting payment");
    }

    await tx
      .update(Orders)
      .set({
        status: "paid",
        paidAt,
        paidBy: received.by,
        paymentReference: received.reference.trim(),
        paymentNote: received.note?.trim() || null,
      })
      .where(eq(Orders.uuid, orderUuid));
  });

  // Outside the transaction on purpose: issuing is idempotent by the invoice
  // row, so a retry after a crash here produces the same invoice rather than a
  // second number for one supply. Holding the lock across it would also hold it
  // across a second read of the order and the seller configuration.
  const invoice = await issueInvoice(orderUuid);

  await db
    .update(Invoices)
    .set({ status: "paid", paidAt })
    .where(eq(Invoices.uuid, invoice.uuid));

  const [updated] = await db
    .select()
    .from(Orders)
    .where(eq(Orders.uuid, orderUuid));
  const [settled] = await db
    .select()
    .from(Invoices)
    .where(eq(Invoices.uuid, invoice.uuid));

  // Told to both sides, and after the money is recorded rather than around it.
  // `notify` swallows its own failures for the same reason the audit trail does:
  // a notification that could not be written must never be why a payment was
  // not recorded.
  const [customer] = await db
    .select({ clerkUserId: Users.clerkUserId })
    .from(Users)
    .where(eq(Users.uuid, updated.userUuid));

  await Promise.all([
    notify({
      audience: "client",
      kind: "invoice_issued",
      recipientClerkUserId: customer?.clerkUserId ?? null,
      title: `Invoice ${settled.number} is ready`,
      body: `We received ${settled.amount} ${settled.currency ?? "SAR"} for ${updated.reference}.`,
      href: `/orders/${updated.uuid}`,
    }),
    notify({
      audience: "admin",
      kind: "payment_recorded",
      title: `Cash recorded for ${updated.reference}`,
      body: `${received.by} recorded ${settled.amount} ${settled.currency ?? "SAR"} against ${received.reference.trim()}.`,
      href: "/orders",
    }),
  ]);

  return { order: updated, invoice: settled };
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
export const getUserOrders = async (userUuid: string): Promise<UserOrder[]> =>
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
