import type { ProductStatus } from "../../../db/enum";

// ---------------------------------------------------------------------------
// P11 — CAN WE ACTUALLY SUPPLY THIS?
//
// `Products.status` has held seven values since the beginning — in_stock,
// out_of_stock, limited_stock, pre_order, in_order, end_of_sale, end_of_life —
// and until this file NOTHING read it except to render a label. `isAvailable`,
// the manual storefront switch, was consulted in exactly one query (the catalog
// list) and by two cards to grey themselves out.
//
// So the whole thing was decoration. An `out_of_stock` product could be added to
// a cart, pass the design gate, pass the pricing gate, be ordered, have cash
// taken against it and be invoiced — and no surface anywhere would notice. A BOQ
// could be designed entirely out of `end_of_life` products and every rule in the
// engine would pass it, because compatibility is a question about whether things
// work together and says nothing about whether they can be bought.
//
// The order path had three gates when this was written: WHO may buy (the
// destination check), WHETHER IT WORKS (the design gate) and WHAT IT COSTS (the
// pricing resolver). This is the fourth and it answers a different question from
// all three: whether the thing exists to be sold.
//
// TWO KINDS OF NO, WHICH IS THE WHOLE DESIGN.
//
// "We cannot get this" and "we cannot get this yet" are not the same answer and
// must not collapse into one. Refusing a `pre_order` line would make pre-order a
// status that cannot be ordered — a contradiction in its own name — and letting
// an `end_of_life` line through commits SOT to delivering something that is not
// manufactured. So `unavailable` refuses and `delayed` informs, and a caller
// that wants to sell has to look at only one of them.
//
// Pure, and separate from the design check on purpose. A design finding is
// snapshotted onto the order as "what this was judged against"; supply is a fact
// about today that will be false next week. Writing today's stock level into a
// commercial document as though it were a verdict would make the snapshot lie.
// ---------------------------------------------------------------------------

export type SupplyState =
  // On the shelf, or near enough to promise.
  | "available"
  // Real, orderable, not here yet. The buyer's call, not ours.
  | "delayed"
  // Cannot be sold. The order path refuses on this and only this.
  | "unavailable";

export type SupplyFacts = {
  // Nullable in the schema, which matters — see `stateOf`.
  status: ProductStatus | null;
  isAvailable: boolean;
};

export type SupplyVerdict = {
  state: SupplyState;
  // What to tell somebody, in their words. Present even for `available`, because
  // limited stock is available and still worth a sentence.
  note: string | null;
};

export type SupplyLine = SupplyFacts & {
  productUuid: string;
  name: string;
  quantity: number;
};

export type AssessedLine = SupplyLine & SupplyVerdict;

export type SupplyAssessment = {
  lines: AssessedLine[];
  // Nothing unavailable in the basket. The one field an order path needs.
  sellable: boolean;
  // Why it is not sellable.
  blocking: AssessedLine[];
  // Sellable, but the buyer should know they are waiting.
  waiting: AssessedLine[];
};

/**
 * What each status means for selling.
 *
 * Written as a total map rather than a chain of ifs so that adding a status to
 * the enum without deciding what it means for supply is a type error rather than
 * a silent `available`. The default a missing branch would fall through to is
 * exactly the wrong one: an unrecognised status becoming sellable is how a
 * discontinued line goes on being sold.
 */
const BY_STATUS: Record<ProductStatus, SupplyVerdict> = {
  in_stock: { state: "available", note: null },

  // Available, and honestly so. Nothing in the model records HOW limited, so the
  // most this flag can support is a caution — claiming a delay we cannot
  // evidence would be as wrong as claiming a stock level we do not hold.
  limited_stock: {
    state: "available",
    note: "Stock is limited — a large quantity may take longer to fulfil.",
  },

  out_of_stock: {
    state: "unavailable",
    note: "This is out of stock and cannot be ordered yet.",
  },

  // Both of these are real products on their way. Refusing them would make the
  // status meaningless.
  pre_order: {
    state: "delayed",
    note: "This is on pre-order and ships when it arrives.",
  },
  in_order: {
    state: "delayed",
    note: "This is on order from the supplier and will follow.",
  },

  // End of SALE refuses. That is what the words mean: existing units stay
  // supported, no new ones are sold. Treating it as merely late would keep
  // taking orders for something nobody will ever ship.
  end_of_sale: {
    state: "unavailable",
    note: "This has reached end of sale and is no longer offered.",
  },
  end_of_life: {
    state: "unavailable",
    note: "This has reached end of life and is no longer supported.",
  },
};

/**
 * One product's supply state.
 *
 * `isAvailable` wins outright, and deliberately. It is the manual switch an
 * operator flips to take something off sale, and a switch that a descriptive
 * status can talk over is not a switch. So `isAvailable: false` refuses whatever
 * the status says.
 *
 * A NULL status contributes no refusal. The column defaults to `in_stock`, so
 * null means nobody has ever said — and "nobody has said" is not evidence that
 * something cannot be supplied. Refusing on it would take the entire catalogue
 * off sale the first time a row was inserted without the field. The operator
 * still has `isAvailable` for the cases they know about, which is the right
 * place for a decision to live: a deliberate flag rather than an absent one.
 */
export const classifySupply = (facts: SupplyFacts): SupplyVerdict => {
  if (!facts.isAvailable) {
    return {
      state: "unavailable",
      note: "This has been withdrawn from sale.",
    };
  }
  if (facts.status === null) {
    return { state: "available", note: null };
  }
  return BY_STATUS[facts.status];
};

/** Whether this basket can be sold, and what to say about it. */
export const assessSupply = (lines: SupplyLine[]): SupplyAssessment => {
  const assessed: AssessedLine[] = lines.map((line) => ({
    ...line,
    ...classifySupply(line),
  }));

  const blocking = assessed.filter((line) => line.state === "unavailable");

  return {
    lines: assessed,
    sellable: blocking.length === 0,
    blocking,
    waiting: assessed.filter((line) => line.state === "delayed"),
  };
};

/**
 * The refusal sentence, naming the products.
 *
 * Named rather than counted for the same reason the pricing refusal names them:
 * "2 items are unavailable" sends somebody to compare their basket against a
 * number, and the basket is where they already are.
 */
export const describeSupply = (blocking: AssessedLine[]): string => {
  if (blocking.length === 0) {
    return "";
  }
  if (blocking.length === 1) {
    return `${blocking[0].name} cannot be supplied — ${lowerFirst(
      blocking[0].note ?? "it is not available.",
    )}`;
  }
  return `${blocking.length} products cannot be supplied: ${blocking
    .map((line) => line.name)
    .join(", ")}`;
};

// Joining a sentence onto a clause. Only the first character moves, so a product
// code that is capitalised for a reason keeps its shape.
const lowerFirst = (sentence: string): string =>
  sentence.charAt(0).toLowerCase() + sentence.slice(1);
