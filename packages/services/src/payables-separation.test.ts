import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// A10 must not be able to see A11.
//
// The split exists because a finance clerk processing partner invoices must not
// see platform margin. A comment saying so is not a guarantee — the failure mode
// is somebody adding "and the order total, while we're here" to a payables query
// in eighteen months, with no test to stop them.
//
// Read as source rather than exercised as behaviour on purpose. What is being
// asserted is what the payables module is ALLOWED TO REACH, and that is a fact
// about its imports, not about any value it happens to return today.
// ---------------------------------------------------------------------------

// Comments are stripped first. The assertion is about what the code REACHES,
// and the file's own prose necessarily uses the very words being banned — it has
// to explain why they are banned.
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const payables = stripComments(
  readFileSync(new URL("./partner-payables.ts", import.meta.url), "utf8"),
);

describe("A10 payables cannot reach A11 figures", () => {
  it("does not import the platform financials module", () => {
    expect(payables).not.toContain("platform-financials");
  });

  it("does not read the Orders table, where revenue lives", () => {
    // Partner payables are one side of a ledger: what is owed. What the customer
    // paid for the same job is the other side, and joining them is the leak.
    expect(payables).not.toMatch(/from\s+["'].*schema\/orders["']/);
    expect(payables).not.toContain("Orders");
  });

  it("names no revenue, cost or margin field", () => {
    for (const forbidden of ["revenue", "margin", "profit", "grandTotal"]) {
      expect(payables.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
