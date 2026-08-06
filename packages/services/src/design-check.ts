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
import {
  evaluateSelection,
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
  tone: "block" | "warn" | "unknown";
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
  // Questions whose answers would change a finding above. Empty when the rules
  // this basket touched need nothing from the buyer.
  questions: DesignQuestion[];
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
  tone:
    finding.status === "block"
      ? "block"
      : finding.status === "warn"
        ? "warn"
        : "unknown",
  corrections: finding.corrections,
  failingProductUuids: finding.failingItems.map((item) => item.productUuid),
  skipped: finding.skipped,
});

/**
 * A vendor-authored incompatibility, as the buyer sees it.
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
const vendorFinding = (
  pair: IncompatibleFinding,
  selection: { productUuid: string; name: string }[],
): DesignFinding => {
  const nameOf = (uuid: string): string =>
    selection.find((item) => item.productUuid === uuid)?.name ?? "this product";
  const a = nameOf(pair.productUuidA);
  const b = nameOf(pair.productUuidB);
  return {
    id: `vendor:${pair.productUuidA}:${pair.productUuidB}`,
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

const EMPTY: DesignCheckResult = {
  blockers: [],
  warnings: [],
  unknowns: [],
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
    const vendorBlocks = incompatiblePairs(
      model.compatibility,
      selection.map((item) => item.productUuid),
    ).map((pair) => vendorFinding(pair, selection));

    return {
      blockers: [...report.blockers.map(toFinding), ...vendorBlocks],
      warnings: report.warnings.map(toFinding),
      unknowns: report.unknowns.map(toFinding),
      questions: pendingQuestions(
        report.findings,
        model.relationships,
        variables,
      ),
      passed: report.passed,
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
    questions: result.questions,
    overridden,
    degraded: result.degraded,
  };
};
