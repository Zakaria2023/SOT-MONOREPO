import { and, desc, eq } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import {
  OrderChanges,
  type SelectOrderChanges,
} from "../../../db/schema/order-changes";
import { OrderItems } from "../../../db/schema/order-items";
import { Orders } from "../../../db/schema/orders";
import { Products } from "../../../db/schema/products";
import type { ScenarioLine } from "../../../db/types";
import { gateSelection } from "./design-check";
import { ConflictError, ValidationError } from "./errors";
import { notify } from "./notifications";
import { describeUnpriced, resolvePricing } from "./price-resolution";
import { priceLinesAsOf } from "./product-pricing";
import { assessSupplyFor } from "./product-supply";
import { describeSupply } from "./supply";

export type { SelectOrderChanges };

// ---------------------------------------------------------------------------
// A13 — CHANGING A PLACED ORDER, AND RE-RUNNING THE ENGINE WHEN IT CHANGES.
//
// Orders were immutable. That is not how installations work: a site visit finds
// one more door than the drawing showed and something has to give.
//
// THE POINT OF THIS FILE IS THE RE-RUN. Editing OrderItems in place would have
// been the obvious move and is the wrong one — an order snapshots the findings it
// was judged against, and swapping the lines underneath leaves it claiming a
// clean bill of health for a basket it no longer contains. A camera added to a
// switch that was already at its PoE limit would go in silently, and the order
// would still say the design passed.
//
// So a change is proposed, judged, and applied — and applying it re-runs the same
// gate that guarded checkout AND rewrites the order's own snapshot. "What was
// this judged against" stays answerable at every point in the order's life.
//
// Judged TWICE, deliberately: once at proposal so somebody can see the verdict
// before agreeing, and again at apply. Between the two, a rule can be published
// or a product discontinued — and the verdict that matters is the one at the
// moment the change lands, not the one that was convenient when it was drafted.
// ---------------------------------------------------------------------------

export type ProposeChangeInput = {
  orderUuid: string;
  lines: ScenarioLine[];
  reason: string;
  proposedBy: string;
};

export type ChangeVerdict = {
  change: SelectOrderChanges;
  // True when the engine refuses the proposed basket. Not a refusal to record
  // the proposal — a change that breaks the design is exactly the thing somebody
  // needs to see written down before deciding.
  blocked: boolean;
  blockers: { title: string; message: string }[];
  // Null when everything priced. A change that cannot be priced cannot be
  // applied, whatever the engine says about it.
  pricingProblem: string | null;
  // Null when everything can be supplied. Same standing as the pricing problem
  // and for the same reason: no verdict from the engine makes a discontinued
  // product deliverable.
  supplyProblem: string | null;
  currentTotal: number;
  proposedTotal: number;
};

const judge = async (
  orderUuid: string,
  lines: ScenarioLine[],
): Promise<{
  blockers: { title: string; message: string }[];
  findings: { id: string; title: string; message: string; tone: string }[];
  total: number;
  pricingProblem: string | null;
  supplyProblem: string | null;
}> => {
  const [order] = await db
    .select()
    .from(Orders)
    .where(eq(Orders.uuid, orderUuid));
  if (!order) {
    throw new ValidationError("That order no longer exists.");
  }

  const active = lines.filter((line) => line.quantity > 0);

  // The same gate checkout runs, on the same answers the order was placed with.
  // Re-judging against today's defaults would refuse a design the buyer was
  // shown as fine, on inputs they never saw.
  const gate = await gateSelection({
    selection: active,
    variables: order.projectInputs ?? undefined,
  });

  const named = await db
    .select({ uuid: Products.uuid, name: Products.name })
    .from(Products);
  const nameOf = new Map(named.map((product) => [product.uuid, product.name]));

  const priced = resolvePricing({
    lines: await priceLinesAsOf(
      active.map((line) => ({
        productUuid: line.productUuid,
        name: nameOf.get(line.productUuid) ?? "a removed product",
        quantity: line.quantity,
      })),
      new Date(),
    ),
    discountPercent: order.discountPercent,
    asOf: new Date(),
  });

  // P11, and this is the path the whole re-run principle was built for. A site
  // visit finds one more door, somebody proposes the camera that was on the
  // original drawing, and that model went end-of-life two months ago. The design
  // engine passes it happily — compatibility says nothing about whether a thing
  // can be bought.
  const supply = await assessSupplyFor(active);

  return {
    blockers: gate.blockers.map((finding) => ({
      title: finding.title,
      message: finding.message,
    })),
    findings: [...gate.blockers, ...gate.warnings, ...gate.unknowns].map(
      (finding) => ({
        id: finding.id,
        title: finding.title,
        message: finding.message,
        tone: finding.tone,
      }),
    ),
    total: priced.netSubtotal,
    pricingProblem: priced.complete
      ? null
      : describeUnpriced(priced.unpriced),
    supplyProblem: supply.sellable ? null : describeSupply(supply.blocking),
  };
};

/**
 * Propose a change, and record what the engine makes of it.
 *
 * Recorded even when it breaks the design. A proposal that is refused is the
 * evidence that stops the same change being suggested again next week, and
 * refusing to write it down loses that.
 */
export const proposeOrderChange = async (
  input: ProposeChangeInput,
): Promise<ChangeVerdict> => {
  if (input.reason.trim() === "") {
    throw new ValidationError(
      "A change to a placed order needs a reason — somebody has to explain it to whoever is paying.",
    );
  }
  if (input.lines.filter((line) => line.quantity > 0).length === 0) {
    throw new ValidationError(
      "A change cannot empty the order. Cancel it instead.",
    );
  }

  const [order] = await db
    .select()
    .from(Orders)
    .where(eq(Orders.uuid, input.orderUuid));
  if (!order) {
    throw new ValidationError("That order no longer exists.");
  }
  if (order.status === "cancelled" || order.status === "refunded") {
    throw new ConflictError(`A ${order.status} order cannot be changed.`);
  }

  const verdict = await judge(input.orderUuid, input.lines);

  const uuid = generateUuid();
  await db.insert(OrderChanges).values({
    uuid,
    reference: `CHG-${uuid.slice(0, 8).toUpperCase()}`,
    orderUuid: input.orderUuid,
    reason: input.reason.trim(),
    lines: input.lines.filter((line) => line.quantity > 0),
    designFindings: verdict.findings,
    grandTotal: verdict.total.toFixed(2),
    proposedBy: input.proposedBy,
  });

  const [change] = await db
    .select()
    .from(OrderChanges)
    .where(eq(OrderChanges.uuid, uuid));

  await notify({
    audience: "admin",
    kind: "boq_status",
    title: `Change ${change.reference} proposed for ${order.reference}`,
    body: verdict.blockers.length
      ? `The engine refuses it: ${verdict.blockers[0].message}`
      : `${verdict.total.toFixed(2)} ${order.currency ?? "SAR"}, was ${order.grandTotal}.`,
    href: "/orders",
  });

  return {
    change,
    blocked: verdict.blockers.length > 0,
    blockers: verdict.blockers,
    pricingProblem: verdict.pricingProblem,
    supplyProblem: verdict.supplyProblem,
    currentTotal: Number(order.grandTotal),
    proposedTotal: verdict.total,
  };
};

export type ApplyChangeInput = {
  changeUuid: string;
  decidedBy: string;
  // A recorded reason lets a change through despite the engine, exactly as the
  // checkout gate allows. Without one, a blocked change stays blocked.
  override?: { allowed: boolean; reason: string };
};

/**
 * Apply it, and rewrite what the order was judged against.
 *
 * The re-run here is the whole point. Between proposal and apply a rule can be
 * published or a product discontinued, so the verdict that decides is the one at
 * the moment the change lands. And the order's own `designFindings` are replaced,
 * because leaving the original snapshot in place would have the order asserting a
 * clean design for a basket it no longer holds.
 */
export const applyOrderChange = async (
  input: ApplyChangeInput,
): Promise<SelectOrderChanges> => {
  const [change] = await db
    .select()
    .from(OrderChanges)
    .where(eq(OrderChanges.uuid, input.changeUuid));
  if (!change) {
    throw new ValidationError("That change no longer exists.");
  }
  if (change.status !== "proposed") {
    throw new ConflictError(`This change has already been ${change.status}.`);
  }

  // Judged again, now. Not the verdict from proposal time.
  const verdict = await judge(change.orderUuid, change.lines);

  // Supply before price, as on the order path: "we have not priced this" invites
  // somebody to go and get a quote, which is the wrong errand for a product that
  // is no longer made.
  //
  // And both before the override is even considered. The override below lets
  // somebody past the ENGINE's refusal, which is a judgement they may be better
  // placed to make than the rules are. This is not a judgement — it is the
  // warehouse — and no reason typed into a box makes a discontinued product
  // arrive.
  if (verdict.supplyProblem) {
    throw new ValidationError(
      `This change cannot be applied: ${verdict.supplyProblem}`,
    );
  }

  if (verdict.pricingProblem) {
    throw new ValidationError(
      `This change cannot be applied: ${verdict.pricingProblem}.`,
    );
  }

  const overridden =
    verdict.blockers.length > 0 &&
    input.override?.allowed === true &&
    input.override.reason.trim().length > 0;

  if (verdict.blockers.length > 0 && !overridden) {
    throw new ConflictError(
      `The engine refuses this change: ${verdict.blockers
        .map((blocker) => blocker.message)
        .join(" ")}`,
    );
  }

  const named = await db
    .select({
      uuid: Products.uuid,
      name: Products.name,
      price: Products.price,
      currency: Products.currency,
    })
    .from(Products);
  const byUuid = new Map(named.map((product) => [product.uuid, product]));

  await db.transaction(async (tx) => {
    // Replaced wholesale rather than diffed. The change carries the whole basket
    // precisely so this does not have to work out which lines moved, and a diff
    // applied to a base that shifted is how quantities end up doubled.
    await tx.delete(OrderItems).where(eq(OrderItems.orderUuid, change.orderUuid));

    const priced = await priceLinesAsOf(
      change.lines.map((line) => ({
        productUuid: line.productUuid,
        name: byUuid.get(line.productUuid)?.name ?? "a removed product",
        quantity: line.quantity,
      })),
      new Date(),
    );

    await tx.insert(OrderItems).values(
      priced.map((line) => ({
        uuid: generateUuid(),
        orderUuid: change.orderUuid,
        productUuid: line.productUuid,
        name: line.name,
        unitPrice: Number(line.price ?? 0).toFixed(2),
        quantity: line.quantity,
        lineTotal: (Number(line.price ?? 0) * line.quantity).toFixed(2),
      })),
    );

    await tx
      .update(Orders)
      .set({
        productTotal: verdict.total.toFixed(2),
        grandTotal: verdict.total.toFixed(2),
        // Rewritten, not appended to. The order's snapshot has to describe the
        // basket it actually holds.
        designFindings: verdict.findings.map((finding) => ({
          id: finding.id,
          title: finding.title,
          message: finding.message,
          family: "match" as const,
          tone: finding.tone as "block" | "warn" | "unknown" | "partial",
          corrections: [],
          failingProductUuids: [],
          skipped: [],
        })),
        designOverrideReason: overridden
          ? (input.override?.reason.trim() ?? null)
          : null,
      })
      .where(eq(Orders.uuid, change.orderUuid));

    await tx
      .update(OrderChanges)
      .set({
        status: "applied",
        decidedBy: input.decidedBy,
        decidedAt: new Date(),
        decisionNote: overridden
          ? `Applied despite the engine: ${input.override?.reason.trim()}`
          : null,
        designFindings: verdict.findings,
        grandTotal: verdict.total.toFixed(2),
      })
      .where(eq(OrderChanges.uuid, input.changeUuid));
  });

  const [applied] = await db
    .select()
    .from(OrderChanges)
    .where(eq(OrderChanges.uuid, input.changeUuid));
  return applied;
};

/** Turn it down, with the reason on the record. */
export const rejectOrderChange = async (
  changeUuid: string,
  decidedBy: string,
  note: string,
): Promise<void> => {
  if (note.trim() === "") {
    throw new ValidationError("Turning a change down needs a reason.");
  }
  const result = await db
    .update(OrderChanges)
    .set({
      status: "rejected",
      decidedBy,
      decidedAt: new Date(),
      decisionNote: note.trim(),
    })
    .where(
      and(
        eq(OrderChanges.uuid, changeUuid),
        eq(OrderChanges.status, "proposed"),
      ),
    );

  const affected = (result as unknown as { affectedRows?: number }[])[0]
    ?.affectedRows;
  if (affected === 0) {
    throw new ConflictError("That change has already been decided.");
  }
};

/** Every change proposed against an order, newest first. */
export const listOrderChanges = async (
  orderUuid: string,
): Promise<SelectOrderChanges[]> =>
  db
    .select()
    .from(OrderChanges)
    .where(eq(OrderChanges.orderUuid, orderUuid))
    .orderBy(desc(OrderChanges.createdAt));
