import { describe, expect, it } from "vitest";
import { boqStatuses, type BoqStatus } from "../../../db/enum";
import {
  BOQ_STAGES,
  canTransition,
  isRegression,
  nextStatuses,
  stageOf,
  statusesThatCanBecome,
} from "./boq-lifecycle";

describe("the seven stages cover the eleven statuses", () => {
  it("places every status in exactly one stage", () => {
    // Fails the moment somebody adds a status without deciding what a customer
    // should be told about it.
    for (const status of boqStatuses) {
      const stages = BOQ_STAGES.filter((stage) =>
        stage.statuses.includes(status),
      );
      expect(stages, `status "${status}"`).toHaveLength(1);
    }
  });

  it("introduces no stage status that is not a real one", () => {
    const known = new Set<string>(boqStatuses);
    for (const stage of BOQ_STAGES) {
      for (const status of stage.statuses) {
        expect(known.has(status), `stage status "${status}"`).toBe(true);
      }
    }
  });

  it("numbers the stages 1 to 7 in order", () => {
    expect(BOQ_STAGES.map((stage) => stage.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it("groups the three installation statuses into one stage", () => {
    // Being installed is one thing to a customer and three to a scheduler.
    expect(stageOf("assigned").number).toBe(5);
    expect(stageOf("installing").number).toBe(5);
    expect(stageOf("installed").number).toBe(5);
  });
});

describe("canTransition", () => {
  it("allows the ordinary forward steps", () => {
    const forward: [BoqStatus, BoqStatus][] = [
      ["draft", "validated"],
      ["validated", "submitted"],
      ["submitted", "reviewed"],
      ["reviewed", "offered"],
      ["offered", "ordered"],
      ["ordered", "assigned"],
      ["assigned", "installing"],
      ["installing", "installed"],
      ["installed", "verified"],
      ["verified", "handed_over"],
    ];
    for (const [from, to] of forward) {
      expect(canTransition(from, to), `${from} -> ${to}`).toEqual({
        allowed: true,
      });
    }
  });

  it("refuses a skipped step", () => {
    const check = canTransition("draft", "ordered");
    expect(check.allowed).toBe(false);
    expect(check.allowed === false && check.reason).toContain("only become");
  });

  it("refuses dragging a finished BOQ backwards", () => {
    // The bug the old code allowed: re-running validation on a handed-over BOQ
    // wrote `validated` with nothing to stop it.
    const check = canTransition("handed_over", "validated");
    expect(check.allowed).toBe(false);
    expect(check.allowed === false && check.reason).toContain("finished");
  });

  it("refuses moving to the status it is already in", () => {
    expect(canTransition("ordered", "ordered").allowed).toBe(false);
  });

  it("ALLOWS a review sending a design back to be corrected", () => {
    // Not a succession, which is exactly why an ordered array could not express
    // it — and why the front half of the lifecycle was left unguarded instead.
    expect(canTransition("submitted", "validated").allowed).toBe(true);
    expect(canTransition("reviewed", "submitted").allowed).toBe(true);
  });

  it("ALLOWS a failed verification sending the job back to site", () => {
    // Without it the only way to record a failed check is to leave the BOQ at
    // `installed` and say nothing, which is how a bad install gets handed over.
    expect(canTransition("verified", "installing").allowed).toBe(true);
  });

  it("allows a quote against a design nobody formally reviewed", () => {
    // Matches what offers.ts already permits. Written down rather than
    // tightened: a model that forbids what the business does gets bypassed.
    expect(canTransition("draft", "offered").allowed).toBe(true);
    expect(canTransition("validated", "offered").allowed).toBe(true);
  });

  it("still refuses a quote on a job already out for installation", () => {
    expect(canTransition("installing", "offered").allowed).toBe(false);
  });

  it("leaves handed_over with nowhere to go", () => {
    expect(nextStatuses("handed_over")).toEqual([]);
  });

  it("keeps every allowed target a real status", () => {
    const known = new Set<string>(boqStatuses);
    for (const status of boqStatuses) {
      for (const next of nextStatuses(status)) {
        expect(known.has(next), `${status} -> ${next}`).toBe(true);
      }
    }
  });
});

describe("isRegression", () => {
  it("calls a backward move backward", () => {
    expect(isRegression("reviewed", "validated")).toBe(false);
    expect(isRegression("offered", "reviewed")).toBe(true);
    expect(isRegression("verified", "installing")).toBe(true);
  });

  it("does not call a forward move backward", () => {
    expect(isRegression("draft", "validated")).toBe(false);
    expect(isRegression("ordered", "assigned")).toBe(false);
  });

  it("is false within one stage", () => {
    // submitted -> validated stays inside stage 2, so it is a correction rather
    // than a visible step back for the customer.
    expect(isRegression("submitted", "validated")).toBe(false);
    expect(isRegression("installing", "assigned")).toBe(false);
  });
});

describe("statusesThatCanBecome", () => {
  it("inverts the map, so a SQL guard can be built from it", () => {
    // The three call sites used to carry their own copy of these lists, and a
    // rule spelled out in three places has three chances to be wrong.
    expect(statusesThatCanBecome("offered").sort()).toEqual(
      ["draft", "reviewed", "submitted", "validated"].sort(),
    );
    expect(statusesThatCanBecome("ordered")).toEqual(["offered"]);
  });

  it("agrees with canTransition in both directions", () => {
    for (const target of boqStatuses) {
      for (const from of statusesThatCanBecome(target)) {
        expect(canTransition(from, target).allowed, `${from} -> ${target}`).toBe(
          true,
        );
      }
    }
  });

  it("says nothing can reach the start", () => {
    expect(statusesThatCanBecome("draft")).toEqual(["validated"]);
  });
});
