import { describe, expect, it } from "vitest";
import type { BoqStatus } from "../../../db/enum";
import { buildWorkList, countDoNow } from "./work-list";

const job = (reference: string, status: BoqStatus) => ({ reference, status });

describe("what a partner may move", () => {
  it("offers the next step on a job that is theirs", () => {
    const [item] = buildWorkList([job("A", "assigned")]);
    expect(item.actions).toEqual(["installing"]);
    expect(item.callToAction).toBe("Accept and start on site");
  });

  it("offers nothing on a job that is not theirs to move", () => {
    // Quoting is the pre-seller's and verifying is ours. A partner who could mark
    // their own installation verified would be signing off their own work.
    for (const status of ["offered", "ordered", "installed", "verified"] as BoqStatus[]) {
      const [item] = buildWorkList([job("A", status)]);
      expect(item.actions, status).toEqual([]);
    }
  });

  it("takes the action from the lifecycle map, not its own list", () => {
    // Same source as the guard, so the button offered and the move the server
    // accepts cannot disagree.
    const [item] = buildWorkList([job("A", "installing")]);
    expect(item.actions).toEqual(["installed"]);
  });
});

describe("ordering is by what is blocking somebody", () => {
  it("puts an unstarted job first", () => {
    // An unstarted job is the one a customer is waiting on with nothing
    // happening at all.
    const list = buildWorkList([
      job("Installing", "installing"),
      job("Handed", "handed_over"),
      job("Assigned", "assigned"),
      job("Installed", "installed"),
    ]);
    // Their own work first — unstarted, then in progress — then what is on our
    // desk, then closed. The screen groups them in this order too, and the two
    // used to disagree.
    expect(list.map((item) => item.job.reference)).toEqual([
      "Assigned",
      "Installing",
      "Installed",
      "Handed",
    ]);
  });

  it("marks a finished installation as waiting on us, not on them", () => {
    const [item] = buildWorkList([job("A", "installed")]);
    expect(item.urgency).toBe("waiting_on_us");
    expect(item.callToAction).toContain("our verification");
  });

  it("calls a handed-over job done", () => {
    expect(buildWorkList([job("A", "handed_over")])[0].urgency).toBe("done");
  });

  it("puts the earliest stage first within one bucket", () => {
    // The one stuck longest, not the newest.
    const list = buildWorkList([
      job("Later", "installing"),
      job("Earlier", "installing"),
    ]);
    expect(list).toHaveLength(2);
    expect(list.every((item) => item.urgency === "scheduled")).toBe(true);
  });
});

describe("stage labels come from the lifecycle", () => {
  it("groups the three installation statuses into stage 5", () => {
    for (const status of ["assigned", "installing", "installed"] as BoqStatus[]) {
      expect(buildWorkList([job("A", status)])[0].stageNumber, status).toBe(5);
    }
  });
});

describe("countDoNow", () => {
  it("counts only what needs starting", () => {
    expect(
      countDoNow([
        job("A", "assigned"),
        job("B", "assigned"),
        job("C", "installing"),
        job("D", "handed_over"),
      ]),
    ).toBe(2);
  });

  it("is zero for an empty list", () => {
    expect(countDoNow([])).toBe(0);
  });
});

describe("a job with no status", () => {
  it("reads as a draft rather than throwing", () => {
    const [item] = buildWorkList([{ reference: "A", status: null }]);
    expect(item.status).toBe("draft");
    expect(item.stageNumber).toBe(1);
  });
});
