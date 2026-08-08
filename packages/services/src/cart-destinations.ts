import type { PartnerCapability } from "../../../db/enum";

// ---------------------------------------------------------------------------
// WHERE A CART CAN GO.
//
// A cart is not one thing. The same basket means three different transactions
// depending on who assembled it and why:
//
//   order       buy it. For a customer, their own equipment; for a partner with
//               the `stock` capability, stock they will resell.
//   boq         hand the design to SOT to be quoted and installed.
//   quote       a partner building FOR a client, who needs a document to give
//               them rather than an order to pay for.
//
// The mode was implicit before: the client cart offered "check out" and "send as
// BOQ" side by side, and the partner app had no cart at all. So a partner had no
// way to assemble anything, and nothing anywhere connected the destinations to
// what a partner is actually approved to do.
//
// THE RULE THAT WAS MISSING: buying for stock requires the `stock` capability.
// It is the capability that means "may hold stock" — it exists, it prices their
// account, and nothing consulted it. A partner approved only to install could
// place a stock order, and the first anyone would know is a warehouse question.
//
// Pure. Which destinations exist is a question about a viewer and a basket, and
// answering it needs neither a database nor a session.
// ---------------------------------------------------------------------------

export type CartDestination = "order" | "boq" | "quote";

export type DestinationOffer = {
  destination: CartDestination;
  // What the button says.
  label: string;
  available: boolean;
  // Why not, when it is not. Null when it is available — an explanation for
  // something that works is noise.
  reason: string | null;
};

export type CartViewer = {
  isPartner: boolean;
  capabilities: PartnerCapability[];
};

export type DestinationInput = {
  viewer: CartViewer;
  lineCount: number;
  // A design the engine still refuses. It does not remove a destination — a
  // buyer may always ask for a quote on something imperfect — but it does stop
  // the two that commit money.
  hasBlockers: boolean;
  // Lines whose product has no price. An order cannot be placed on them; a BOQ
  // and a quote can, because both are requests for a price rather than payment
  // of one.
  hasUnpricedLines: boolean;
};

const EMPTY = "There is nothing in this basket yet.";

/**
 * Every destination, with the ones that are closed explained rather than hidden.
 *
 * Hiding an unavailable action leaves somebody hunting for a button that was
 * never there. Showing it greyed with "you are not approved to hold stock" is
 * the difference between a dead end and an answer.
 */
export const cartDestinations = (
  input: DestinationInput,
): DestinationOffer[] => {
  const { viewer, lineCount, hasBlockers, hasUnpricedLines } = input;
  const empty = lineCount === 0;
  const holdsStock = viewer.capabilities.includes("stock");

  const orderReason = (): string | null => {
    if (empty) {
      return EMPTY;
    }
    if (viewer.isPartner && !holdsStock) {
      // Named precisely. "Not allowed" sends a partner to support; naming the
      // capability sends them to the person who can grant it.
      return "Buying stock needs the “may hold stock” capability, which this account does not have.";
    }
    if (hasBlockers) {
      return "This design cannot be ordered until the problems with it are sorted out.";
    }
    if (hasUnpricedLines) {
      return "Some of these products have no price yet. Ask for a quote instead.";
    }
    return null;
  };

  const boqReason = (): string | null => {
    if (empty) {
      return EMPTY;
    }
    if (hasBlockers) {
      // A BOQ is a request for SOT to build this. Sending one that the engine
      // refuses wastes a reviewer's afternoon on a design the buyer could have
      // been told about in the cart.
      return "Sort out the problems with this design first — otherwise it comes straight back.";
    }
    return null;
  };

  const quoteReason = (): string | null => {
    if (empty) {
      return EMPTY;
    }
    if (!viewer.isPartner) {
      return "Quoting is for partners building on behalf of a client.";
    }
    // Deliberately NOT blocked by findings or missing prices. A partner asking
    // what something would cost is asking a question, and refusing to answer it
    // because the design is not final is refusing at the exact moment the answer
    // is most useful.
    return null;
  };

  const offers: [CartDestination, string, string | null][] = [
    [
      "order",
      viewer.isPartner ? "Buy this as stock" : "Check out",
      orderReason(),
    ],
    ["boq", "Send to SOT to be built", boqReason()],
    ["quote", "Quote this for a client", quoteReason()],
  ];

  return offers.map(([destination, label, reason]) => ({
    destination,
    label,
    available: reason === null,
    reason,
  }));
};

/** The destinations somebody can actually use right now. */
export const availableDestinations = (
  input: DestinationInput,
): CartDestination[] =>
  cartDestinations(input)
    .filter((offer) => offer.available)
    .map((offer) => offer.destination);

/**
 * Whether a destination may be used, for the server to check again.
 *
 * The cart screen decides what to show; this decides what may happen. A rule
 * enforced only where the button is drawn is bypassed by anything that posts
 * directly — the same reasoning that puts the design gate inside order creation
 * rather than in the cart UI.
 */
export const canSendTo = (
  destination: CartDestination,
  input: DestinationInput,
): { allowed: boolean; reason: string | null } => {
  const offer = cartDestinations(input).find(
    (entry) => entry.destination === destination,
  );
  if (!offer) {
    return { allowed: false, reason: "That is not somewhere a cart can go." };
  }
  return { allowed: offer.available, reason: offer.reason };
};
