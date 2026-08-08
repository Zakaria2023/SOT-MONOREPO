"use server";

import { getCurrentUser } from "@/lib/auth";
import { getUserOrder, type SelectOrders } from "services";

// E8 — payment, cash only.
//
// There used to be a `payOrder` here: a simulated gateway that waited 1.2
// seconds and then marked the order paid. That was a fair placeholder for a card
// flow, and it is the wrong shape for cash.
//
// Cash is handed to a person. The customer cannot attest that it arrived —
// only whoever received it can — so there is deliberately no action on this
// surface that settles an order. What the customer gets is the reference to quote
// and the amount to pay; the recording happens on the admin side, by the person
// holding the money.
//
// Removing the button rather than disabling it is the point. A pay button that
// does nothing teaches people the site is broken; no button, with instructions
// beside the total, teaches them what to do next.

export type PaymentInstructions = {
  reference: SelectOrders["reference"];
  amount: SelectOrders["grandTotal"];
  currency: SelectOrders["currency"];
  status: SelectOrders["status"];
  // Null until somebody records the cash. Shown back to the customer so they can
  // see their payment landed and against what.
  paymentReference: SelectOrders["paymentReference"];
  paidAt: SelectOrders["paidAt"];
};

/** What to pay, and how to be recognised when paying it. */
export const getPaymentInstructions = async (
  orderUuid: string,
): Promise<PaymentInstructions | null> => {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const order = await getUserOrder(user.uuid, orderUuid);
  if (!order) {
    return null;
  }

  return {
    reference: order.reference,
    amount: order.grandTotal,
    currency: order.currency,
    status: order.status,
    paymentReference: order.paymentReference,
    paidAt: order.paidAt,
  };
};
