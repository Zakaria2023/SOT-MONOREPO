import { describe, expect, it } from "vitest";
import { boqStatuses, type BoqStatus } from "../../../db/enum";
import { buildOrderTracking, describeStage } from "./order-tracking";
import { buildWorkList } from "./work-list";

const tracked = (boqStatus: BoqStatus | null, orderStatus = "paid" as const) =>
  buildOrderTracking({ orderStatus, boqStatus });

describe("who the customer is waiting on", () => {
  it("says it is on them while the money is outstanding", () => {
    // The case a step count hides. An order sitting unpaid for a week is waiting
    // on the customer, and a bar reading "step 4 of 7" has told them the
    // opposite.
    const tracking = buildOrderTracking({
      orderStatus: "awaiting_payment",
      boqStatus: "ordered",
    });
    expect(tracking.waitingOn).toBe("you");
  });

  it("puts the money before the BOQ, however far the job has run", () => {
    // A job can be assigned before the cash arrives. The blocking thing is still
    // the payment.
    const tracking = buildOrderTracking({
      orderStatus: "awaiting_payment",
      boqStatus: "installing",
    });
    expect(tracking.waitingOn).toBe("you");
  });

  it("names the installer only while they have it", () => {
    expect(tracked("assigned").waitingOn).toBe("installer");
    expect(tracked("installing").waitingOn).toBe("installer");
    // Their part is finished; verification is ours.
    expect(tracked("installed").waitingOn).toBe("sot");
  });

  it("waits on nobody once it is handed over", () => {
    const tracking = tracked("handed_over");
    expect(tracking.finished).toBe(true);
    expect(tracking.waitingOn).toBeNull();
  });

  it("has something to say about every status", () => {
    for (const status of boqStatuses) {
      expect(describeStage(status), status).toBeTruthy();
      expect(tracked(status).waitingLabel, status).toBeTruthy();
    }
  });
});

describe("the two screens agree", () => {
  it("names the installer exactly when the partner's list says it is theirs", () => {
    // Both sides read the same statuses. If this said "your installer is working
    // on it" while the partner's work list showed the job on our desk, one of
    // them is lying to somebody who will compare notes.
    for (const status of boqStatuses) {
      const [item] = buildWorkList([{ status }]);
      const partnersMove =
        item.urgency === "do_now" || item.urgency === "scheduled";
      const customerToldInstaller = tracked(status).waitingOn === "installer";

      expect(customerToldInstaller, status).toBe(partnersMove);
    }
  });
});

describe("the ladder itself", () => {
  it("marks everything before the current stage done", () => {
    const { steps } = tracked("installing");
    const current = steps.find((step) => step.state === "current");
    expect(current?.number).toBe(5);
    expect(steps.filter((step) => step.state === "done")).toHaveLength(4);
  });

  it("draws no ladder for an order that stopped", () => {
    // Seven steps against a cancelled order say it is still moving.
    for (const orderStatus of ["cancelled", "refunded"] as const) {
      const tracking = buildOrderTracking({ orderStatus, boqStatus: "ordered" });
      expect(tracking.steps, orderStatus).toEqual([]);
      expect(tracking.stopped, orderStatus).toBe(true);
      expect(tracking.finished, orderStatus).toBe(false);
    }
  });

  it("gives a direct order the two rungs it actually has", () => {
    // No delivery model exists, so a "Delivered" step could never be set and the
    // bar would never fill. A step that never advances reads as a stall.
    const tracking = tracked(null);
    expect(tracking.steps).toHaveLength(2);
    expect(tracking.steps.map((step) => step.title)).toEqual([
      "Ordered",
      "Paid",
    ]);
  });

  it("does not call a paid direct order finished", () => {
    // Paid is not received. Closing the job here would tell somebody their
    // hardware arrived.
    const tracking = tracked(null);
    expect(tracking.finished).toBe(false);
    expect(tracking.waitingOn).toBe("sot");
  });
});
