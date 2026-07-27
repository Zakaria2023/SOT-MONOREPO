import type { RelationshipFamily } from "../../../db/enum";
import type { CorrectionShape } from "../../../db/types";
import {
  getCatalogModel,
  loadSelection,
  loadSuggestionCatalog,
  type SelectionLine,
} from "./catalog-model";
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
};

export type DesignCheckResult = {
  blockers: DesignFinding[];
  warnings: DesignFinding[];
  // Checks that could not run — missing product data, or a project input the
  // buyer has not answered. Surfaced, never swallowed: a check we could not run
  // must not look like a check that passed.
  unknowns: DesignFinding[];
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
  variables?: Record<string, number | boolean>;
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
});

const EMPTY: DesignCheckResult = {
  blockers: [],
  warnings: [],
  unknowns: [],
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

    return {
      blockers: report.blockers.map(toFinding),
      warnings: report.warnings.map(toFinding),
      unknowns: report.unknowns.map(toFinding),
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
    overridden,
    degraded: result.degraded,
  };
};
