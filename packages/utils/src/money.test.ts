import { describe, expect, it } from "vitest";
import {
  applyPercentDiscount,
  fromMinorUnits,
  lineTotal,
  summarizeCart,
  toMinorUnits,
} from "./index";

// Money is accumulated in integer minor units everywhere in this codebase.
// These cover why: the float equivalents are wrong in ways that survive a
// casual read and only surface once there are enough rows.

describe("minor units", () => {
  it("parses a decimal string exactly", () => {
    expect(toMinorUnits("4200.55")).toBe(420055);
    expect(toMinorUnits("0.1")).toBe(10);
    expect(fromMinorUnits(420055)).toBe(4200.55);
  });

  it("counts a missing price as zero rather than NaN", () => {
    // An unpriced product must not poison a cart total.
    expect(toMinorUnits(null)).toBe(0);
  });

  it("stays exact where float addition does not", () => {
    // The canonical case: 0.1 + 0.2 is not 0.3 in binary floating point.
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(fromMinorUnits(toMinorUnits("0.1") + toMinorUnits("0.2"))).toBe(0.3);
  });

  it("does not drift across many rows, where a float reduce does", () => {
    // A partner with a long earnings history. Summing decimal strings as
    // floats loses a cent here; toFixed at the end cannot recover it, because
    // the error happened mid-sum.
    const rows = Array.from({ length: 300 }, () => "0.07");

    const asFloat = rows.reduce((sum, amount) => sum + Number(amount), 0);
    const asMinor = rows.reduce((sum, amount) => sum + toMinorUnits(amount), 0);

    expect(fromMinorUnits(asMinor)).toBe(21);
    expect(asFloat).not.toBe(21);
    expect(fromMinorUnits(asMinor).toFixed(2)).toBe("21.00");
  });

  it("multiplies a line before converting back, not after", () => {
    // 19.99 x 3 in floats is 59.96999999999999.
    expect(lineTotal("19.99", 3)).toBe(59.97);
  });
});

describe("applyPercentDiscount", () => {
  it("applies a whole-percent discount exactly", () => {
    expect(applyPercentDiscount("100.00", 15)).toBe(85);
    expect(applyPercentDiscount("19.99", 10)).toBe(17.99);
  });

  it("clamps out-of-range percents instead of inverting the price", () => {
    // A negative percent would otherwise INCREASE the price, and over 100
    // would make it negative — both are money bugs, not display bugs.
    expect(applyPercentDiscount("100.00", -20)).toBe(100);
    expect(applyPercentDiscount("100.00", 150)).toBe(0);
  });

  it("treats a missing price as zero", () => {
    expect(applyPercentDiscount(null, 20)).toBe(0);
  });
});

describe("summarizeCart", () => {
  it("adds 15% VAT and totals exactly", () => {
    const { subtotal, vat, total } = summarizeCart([
      { unitPrice: "100.00", quantity: 1 },
    ]);
    expect(subtotal).toBe(100);
    expect(vat).toBe(15);
    expect(total).toBe(115);
  });

  it("rounds VAT to the cent rather than carrying a fraction", () => {
    // 19.99 x 15% is 2.9985 — carried unrounded it would make the total
    // 22.9885, which is not a payable amount.
    const { vat, total } = summarizeCart([
      { unitPrice: "19.99", quantity: 1 },
    ]);
    expect(vat).toBe(3);
    expect(total).toBe(22.99);
  });

  it("multiplies each line before summing", () => {
    const { subtotal } = summarizeCart([
      { unitPrice: "19.99", quantity: 3 },
      { unitPrice: "0.07", quantity: 300 },
    ]);
    expect(subtotal).toBe(80.97);
  });

  it("survives a cart of many small lines without drifting", () => {
    const lines = Array.from({ length: 300 }, () => ({
      unitPrice: "0.07",
      quantity: 1,
    }));
    expect(summarizeCart(lines).subtotal).toBe(21);
  });

  it("treats an unpriced line as zero rather than NaN", () => {
    const { subtotal, total } = summarizeCart([
      { unitPrice: null, quantity: 2 },
      { unitPrice: "10.00", quantity: 1 },
    ]);
    expect(subtotal).toBe(10);
    expect(total).toBe(11.5);
  });
});
