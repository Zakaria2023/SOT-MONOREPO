import type { RelationshipFamily } from "../../../db/enum";
import type { CorrectionShape, ProjectAnswers } from "../../../db/types";
import {
  getCatalogModel,
  loadSelection,
  loadSuggestionCatalog,
  type SelectionLine,
} from "./catalog-model";
import { pendingQuestions, type DesignQuestion } from "./design-questions";
import {
  incompatiblePairs,
  type IncompatibleFinding,
} from "./product-compatibility";
import { missingParts, type MissingPart } from "./product-composition";
import {
  evaluateSelection,
  splitPasses,
  type EngineVariable,
  type Finding,
} from "./relationship-engine";

// ---------------------------------------------------------------------------
// The design check — the one place both transports run, because two copies
// would drift and a buyer would be blocked on the web and waved through on
// mobile.
//
// It is also the gate. The cart UI shows it live, and order creation runs it
// AGAIN and refuses: a check that only lives in the UI is bypassed by any direct
// API call.
// ---------------------------------------------------------------------------

// A customer-facing finding. Deliberately narrower than the engine's own
// Finding: the buyer needs the sentence, the numbers and the fixes, not the
// participant lists and bin packing.
export type DesignFinding = {
  id: string;
  title: string;
  message: string;
  family: RelationshipFamily;
  // `partial` is a pass that could not read every item it matched. It is not
  // `unknown` — that would tell a buyer nothing was checked when most of it was —
  // and it is not a plain pass either.
  tone: "block" | "warn" | "unknown" | "partial";
  corrections: {
    shape: CorrectionShape;
    message: string;
    products: { productUuid: string; name: string; capacity: number }[];
  }[];
  // Named so the buyer can see which line the problem is on.
  failingProductUuids: string[];
  // The items the check could not read, and what was missing from each. The
  // message already says this in a sentence, but a sentence that joins three
  // products with semicolons is not readable at cart width — a surface that wants
  // to list them a line each needs the parts, not the prose.
  skipped: { productUuid: string; name: string; missing: string[] }[];
};

export type DesignCheckResult = {
  blockers: DesignFinding[];
  warnings: DesignFinding[];
  // Checks that could not run — missing product data, or a project input the
  // buyer has not answered. Surfaced, never swallowed: a check we could not run
  // must not look like a check that passed.
  unknowns: DesignFinding[];
  // Checks that DID reach a verdict, and could not read every item they matched.
  //
  // The engine has always carried the skipped items on the finding. The finding
  // itself used to be thrown away when its status was `pass`, so a rule that
  // approved three products while unable to read five reported as a clean pass
  // and the buyer was told nothing at all. That is the precise failure the
  // skipped list exists to prevent, reintroduced at this boundary.
  //
  // Not a failure — what the rule could read was fine — and so it does not gate.
  // But it is not the clean pass `passed` implies either, which is why it is
  // counted apart from it rather than folded in.
  partial: DesignFinding[];
  // Questions whose answers would change a finding above. Empty when the rules
  // this basket touched need nothing from the buyer.
  questions: DesignQuestion[];
  // Rules that passed having read everything they matched. Deliberately NOT the
  // total number of passes — a partial pass is reported in `partial`, so this
  // number can be shown to a buyer as "checks that fully cleared" without it
  // being a lie.
  passed: number;
  // True when the engine itself failed. The sale is allowed through (blocking
  // real revenue on our own bug is worse than shipping one bad design) but the
  // caller must be able to tell "nothing was wrong" from "we could not look".
  degraded: boolean;
};

export type DesignCheckInput = {
  selection: SelectionLine[];
  // Buyer answers to project questions, keyed by ProjectVariables.uuid. A
  // variable with no answer here falls back to its default, and a rule needing
  // one with neither does not run.
  variables?: ProjectAnswers;
  region?: string;
};

const toFinding = (finding: Finding): DesignFinding => ({
  id: `${finding.family}:${finding.relationshipUuid}`,
  title: finding.name,
  message: finding.message,
  family: finding.family,
  // A `pass` only ever reaches here through the partial list — a clean pass is
  // counted, not carried — so mapping it to `partial` cannot mislabel anything.
  tone:
    finding.status === "block"
      ? "block"
      : finding.status === "warn"
        ? "warn"
        : finding.status === "pass"
          ? "partial"
          : "unknown",
  corrections: finding.corrections,
  failingProductUuids: finding.failingItems.map((item) => item.productUuid),
  skipped: finding.skipped,
});

/**
 * A brand-authored incompatibility, as the buyer sees it.
 *
 * `family: "match"` because that is what it IS from the buyer's side — two
 * things that do not go together — and the tone vocabulary is shared with every
 * other finding so a surface does not need a special case to render it.
 *
 * Always a BLOCK. The bar for blocking is deliberately very high everywhere else
 * in this model, and downshifts and uncertified-but-functional combinations are
 * warnings. This clears that bar for the one reason nothing else does: the
 * manufacturer has said in writing that these two do not work together, and
 * there is no reading of "compatible" left to argue about.
 *
 * The note and the source are carried into the message because a finding that
 * says "these do not work together" and cannot say who says so is one the buyer
 * cannot act on and support cannot defend.
 */
const brandFinding = (
  pair: IncompatibleFinding,
  selection: { productUuid: string; name: string }[],
): DesignFinding => {
  const nameOf = (uuid: string): string =>
    selection.find((item) => item.productUuid === uuid)?.name ?? "this product";
  const a = nameOf(pair.productUuidA);
  const b = nameOf(pair.productUuidB);
  return {
    id: `brand:${pair.productUuidA}:${pair.productUuidB}`,
    title: `${a} does not work with ${b}`,
    message: pair.note
      ? `${pair.note} (${pair.source})`
      : `${a} and ${b} are listed as incompatible by the manufacturer (${pair.source}).`,
    family: "match",
    tone: "block",
    // No correction. Every other shape here is computed — swap for a bigger one,
    // add supply, reduce demand — and this one has no arithmetic behind it to
    // compute from. Inventing "try something else" would be filling the slot
    // rather than answering it.
    corrections: [],
    failingProductUuids: [pair.productUuidA, pair.productUuidB],
    skipped: [],
  };
};

/**
 * A part the basket is short of, as the buyer sees it.
 *
 * A WARNING, not a block, and the difference is the whole judgement. The parts
 * are real — DoubleButton genuinely does not mount without its Holder — but a
 * buyer may already own one, may be adding it on a second order, or may be a
 * partner who keeps a box of them. Refusing the sale in any of those cases is a
 * false block, and §6.4 is explicit that a false block costs more than a missed
 * warning.
 *
 * `family: "presence"` because that is what it is: a companion that should be
 * there and isn't. It reaches the buyer through the same shape as every other
 * finding, so no surface needs a special case to render it.
 */
const compositionFinding = (
  missing: MissingPart,
  selection: { productUuid: string; name: string }[],
): DesignFinding => {
  const parentName =
    selection.find((item) => item.productUuid === missing.parentUuid)?.name ??
    "A product in your basket";
  const quantity = missing.shortBy > 1 ? `${missing.shortBy} × ` : "";
  return {
    id: `composition:${missing.parentUuid}:${missing.childUuid}`,
    title: `${parentName} needs ${quantity}${missing.childName}`,
    message: missing.note
      ? `${missing.note} It is sold separately, and your basket is ${missing.shortBy} short.`
      : `${missing.childName} is sold separately and is needed for ${parentName} to work as described. Your basket is ${missing.shortBy} short.`,
    family: "presence",
    tone: "warn",
    // The fix is not a computation, it is the named part. Reusing `add_supply`
    // rather than inventing a shape lets the cart render its existing "add this"
    // affordance, and the product it names is the answer rather than a guess at
    // one.
    corrections: [
      {
        shape: "add_supply",
        message: `Add ${quantity}${missing.childName}`,
        products: [
          {
            productUuid: missing.childUuid,
            name: missing.childName,
            capacity: missing.shortBy,
          },
        ],
      },
    ],
    failingProductUuids: [missing.parentUuid],
    skipped: [],
  };
};

const EMPTY: DesignCheckResult = {
  blockers: [],
  warnings: [],
  unknowns: [],
  partial: [],
  questions: [],
  passed: 0,
  degraded: false,
};

/**
 * Run every published relationship over a selection.
 *
 * Always over the WHOLE selection, never incrementally: fixing one line can
 * create a violation somewhere else (a bigger switch draws more from the UPS),
 * and the cascade is the part that makes the check trustworthy.
 */
export const checkDesign = async (
  input: DesignCheckInput,
): Promise<DesignCheckResult> => {
  const lines = input.selection.filter((line) => line.quantity > 0);
  if (lines.length === 0) {
    return EMPTY;
  }

  try {
    const [model, selection, catalog] = await Promise.all([
      getCatalogModel(),
      loadSelection(lines),
      loadSuggestionCatalog(),
    ]);
    if (selection.length === 0) {
      return EMPTY;
    }

    // Buyer answers override the authored defaults.
    const variables = new Map<string, EngineVariable>(
      model.variables.map((variable) => [
        variable.uuid,
        input.variables && variable.uuid in input.variables
          ? { ...variable, value: input.variables[variable.uuid] }
          : variable,
      ]),
    );

    const report = evaluateSelection(model.relationships, selection, {
      attributes: model.attributes,
      variables,
      catalog,
      region: input.region,
    });

    // The exception list, checked alongside the derived rules rather than
    // through them. It is not a seventh family — a family is a way of COMPUTING
    // an answer from attributes, and this is a stored answer about two named
    // products. Folding it in would have meant a family whose operands name
    // products, which is the one thing the relationship model refuses.
    const brandBlocks = incompatiblePairs(
      model.compatibility,
      selection.map((item) => item.productUuid),
    ).map((pair) => brandFinding(pair, selection));

    // Parts sold separately that the basket does not hold. Alongside the rules
    // rather than through them, for the same reason the exception list is: this
    // compares products to products, and a relationship compares attributes.
    const compositionWarnings = missingParts(
      model.composition,
      selection.map((item) => ({
        productUuid: item.productUuid,
        quantity: item.quantity,
      })),
    ).map((missing) => compositionFinding(missing, selection));

    // A pass that could not read everything it matched, told apart from one that
    // could. The engine's own `passed` total counts both together, and a buyer
    // has to be able to see the difference.
    const { clean, partial } = splitPasses(report.findings);

    return {
      blockers: [...report.blockers.map(toFinding), ...brandBlocks],
      warnings: [...report.warnings.map(toFinding), ...compositionWarnings],
      unknowns: report.unknowns.map(toFinding),
      partial: partial.map(toFinding),
      questions: pendingQuestions(
        report.findings,
        model.relationships,
        variables,
      ),
      passed: clean,
      degraded: false,
    };
  } catch (error) {
    // Fail OPEN, loudly. A crash in validation must not take checkout down, but
    // it must never masquerade as a clean bill of health either — `degraded`
    // tells the caller the difference.
    console.error("checkDesign failed:", error);
    return { ...EMPTY, degraded: true };
  }
};

export type GateDecision = {
  allowed: boolean;
  blockers: DesignFinding[];
  warnings: DesignFinding[];
  // Checks that could not run at the moment of the decision. They do NOT gate —
  // refusing an order because our own data was incomplete punishes the buyer for
  // our gap. But they are carried, because an order snapshot that records only
  // what we managed to check cannot later tell "nothing was wrong" from "we
  // never looked", and that snapshot is how a wrong rule gets found.
  unknowns: DesignFinding[];
  // Checks that cleared without covering everything. Carried into the snapshot
  // for exactly the reason the unknowns are: an order that recorded "all checks
  // passed" when five products were never read cannot later be told apart from
  // one that was genuinely clean, and that snapshot is how a wrong rule is found.
  partial: DesignFinding[];
  // Questions still unanswered at the moment of the decision. Carried for the
  // same reason as the unknowns: a refusal that says "incompatible" when the real
  // problem is a question nobody was asked sends the buyer looking for a fault in
  // the products.
  questions: DesignQuestion[];
  // Set when the buyer is allowed through despite blockers, because they have a
  // recorded override.
  overridden: boolean;
  degraded: boolean;
};

export type GateInput = DesignCheckInput & {
  // A partner may know better than the catalog, so a recorded reason lets the
  // order through. An ordinary user cannot override — they have no way to judge
  // whether the engine is wrong.
  override?: { allowed: boolean; reason: string };
};

/**
 * The purchase gate. Called by order creation on the server, whatever the
 * transport.
 *
 * An override is honoured only when the caller says the actor is allowed one,
 * and the reason is what makes it auditable — it is also the fastest way to find
 * out which rules are wrong.
 */
export const gateSelection = async (
  input: GateInput,
): Promise<GateDecision> => {
  const result = await checkDesign(input);
  const hasBlockers = result.blockers.length > 0;
  const override = input.override;
  const overridden =
    hasBlockers === true &&
    override?.allowed === true &&
    override.reason.trim().length > 0;

  return {
    allowed: !hasBlockers || overridden,
    blockers: result.blockers,
    warnings: result.warnings,
    unknowns: result.unknowns,
    partial: result.partial,
    questions: result.questions,
    overridden,
    degraded: result.degraded,
  };
};
