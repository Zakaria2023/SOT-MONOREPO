import { checkCompatibility } from "./check-compatibility";
import { checkCartPresence } from "./presence-rules";
import type { PresenceFinding } from "./presence-engine";
import type { RuleEvaluation, SelectionInput } from "./rule-engine";

// The design check over a selection, in one place because both transports run
// it: the web cart through a Server Action, the mobile app through
// /api/v1/design-check. Two copies would drift, and a buyer would be blocked on
// one surface and waved through on the other.

// A unified, customer-facing finding — from either engine, in one shape.
export type DesignFinding = {
  id: string;
  title: string;
  message: string;
  tone: "block" | "warn";
  suggestions: string[];
};

export type DesignCheckResult = {
  blockers: DesignFinding[];
  warnings: DesignFinding[];
};

const ruleToFinding = (result: RuleEvaluation): DesignFinding => ({
  id: `rule:${result.ruleUuid}`,
  title: result.name,
  message: result.message,
  tone: result.status === "fail" ? "block" : "warn",
  suggestions: result.suggestions.map(
    (suggestion) =>
      `${suggestion.name}${
        suggestion.capacity
          ? ` (${suggestion.capacity}${result.unit ? ` ${result.unit}` : ""})`
          : ""
      }`,
  ),
});

const presenceToFinding = (finding: PresenceFinding): DesignFinding => ({
  id: `presence:${finding.ruleId}:${finding.groupDescription}`,
  title: finding.name,
  message: finding.message,
  tone: finding.severity === "hard" ? "block" : "warn",
  suggestions: [],
});

/**
 * Requires-companion (Presence — what's MISSING) plus compatibility relations
 * (Budget/Count/Match/Ratio/Conditional — what conflicts).
 *
 * Advisory by nature: a failure inside the engines must never break the cart,
 * so it returns no findings rather than throwing. Callers split blockers from
 * warnings — blockers gate checkout, warnings only caution.
 */
export const checkDesign = async (
  selection: SelectionInput[],
): Promise<DesignCheckResult> => {
  if (selection.length === 0) {
    return { blockers: [], warnings: [] };
  }
  try {
    const [report, presence] = await Promise.all([
      checkCompatibility(selection),
      checkCartPresence(selection),
    ]);
    const findings: DesignFinding[] = [
      // Missing companions first — the most actionable for the buyer.
      ...presence.findings.map(presenceToFinding),
      ...report.results
        .filter(
          (result) => result.status === "fail" || result.status === "warn",
        )
        .map(ruleToFinding),
    ];
    return {
      blockers: findings.filter((finding) => finding.tone === "block"),
      warnings: findings.filter((finding) => finding.tone === "warn"),
    };
  } catch (error) {
    console.error("checkDesign failed:", error);
    return { blockers: [], warnings: [] };
  }
};
