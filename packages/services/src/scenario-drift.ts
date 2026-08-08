import type { FindingStatus } from "../../../db/enum";
import type { ScenarioRuleVerdict, ScenarioSnapshot } from "../../../db/types";

// ---------------------------------------------------------------------------
// WHAT CHANGED SINCE SOMEBODY SAID THIS WAS RIGHT.
//
// A regression suite over a live catalogue has a problem a suite over a repo
// does not: the catalogue moves underneath it for reasons that are nobody's
// mistake. A rule is added. A product is discontinued. So "the answer differs"
// is not the same as "something broke", and a report that cannot tell them apart
// gets ignored on its third false alarm.
//
// Four things can differ, and only one of them is a regression by itself:
//
//   changed      a rule that ran then and runs now, and says something else.
//                THIS is the regression. Everything else is context.
//   appeared     a rule authored since the baseline. Not a failure — it has
//                simply never been agreed to. Needs a look, not an alarm.
//   disappeared  a rule deleted since. Also not a failure, but worth saying
//                out loud: a scenario that was protecting something is now
//                protecting less than it was.
//   coverage     the status held, and the rule now reads FEWER products than it
//                did. "pass" before and "pass" after, on half the basket. This
//                is the one a status comparison alone would miss entirely, and
//                it is exactly the failure the partial-pass split exists for.
// ---------------------------------------------------------------------------

export type StatusChange = {
  relationshipUuid: string;
  name: string;
  before: FindingStatus;
  after: FindingStatus;
};

export type CoverageChange = {
  relationshipUuid: string;
  name: string;
  status: FindingStatus;
  // Products the rule read at baseline and cannot read now.
  newlySkipped: string[];
  // Products it could not read then and can now — a fix, reported so the
  // baseline gets re-agreed rather than quietly drifting.
  newlyRead: string[];
};

export type ScenarioDrift = {
  changed: StatusChange[];
  appeared: ScenarioRuleVerdict[];
  disappeared: ScenarioRuleVerdict[];
  coverage: CoverageChange[];
  // True only when a rule that existed at baseline now says something else.
  // A new rule cannot regress a scenario that never agreed to it.
  regressed: boolean;
  // True when nothing differs at all, in any of the four senses.
  identical: boolean;
};

/**
 * Compare a fresh run against the agreed answer.
 *
 * Matched on relationship uuid, never on name: renaming a rule must not read as
 * one rule vanishing and another appearing.
 */
export const diffScenario = (
  expected: ScenarioSnapshot,
  actual: ScenarioSnapshot,
): ScenarioDrift => {
  const before = new Map(
    expected.rules.map((rule) => [rule.relationshipUuid, rule] as const),
  );
  const after = new Map(
    actual.rules.map((rule) => [rule.relationshipUuid, rule] as const),
  );

  const changed: StatusChange[] = [];
  const coverage: CoverageChange[] = [];

  for (const [uuid, was] of before) {
    const now = after.get(uuid);
    if (!now) {
      continue;
    }
    if (was.status !== now.status) {
      // Reported by its CURRENT name — the person reading this is looking at
      // today's rule list, not the one from the day it was baselined.
      changed.push({
        relationshipUuid: uuid,
        name: now.name,
        before: was.status,
        after: now.status,
      });
      continue;
    }

    // Same verdict. Did it reach the same products to arrive at it?
    const wasSkipped = new Set(was.skippedProductUuids);
    const nowSkipped = new Set(now.skippedProductUuids);
    const newlySkipped = now.skippedProductUuids.filter(
      (productUuid) => !wasSkipped.has(productUuid),
    );
    const newlyRead = was.skippedProductUuids.filter(
      (productUuid) => !nowSkipped.has(productUuid),
    );
    if (newlySkipped.length > 0 || newlyRead.length > 0) {
      coverage.push({
        relationshipUuid: uuid,
        name: now.name,
        status: now.status,
        newlySkipped,
        newlyRead,
      });
    }
  }

  const appeared = actual.rules.filter(
    (rule) => !before.has(rule.relationshipUuid),
  );
  const disappeared = expected.rules.filter(
    (rule) => !after.has(rule.relationshipUuid),
  );

  return {
    changed,
    appeared,
    disappeared,
    coverage,
    regressed: changed.length > 0,
    identical:
      changed.length === 0 &&
      appeared.length === 0 &&
      disappeared.length === 0 &&
      coverage.length === 0,
  };
};
