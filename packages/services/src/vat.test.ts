import { describe, expect, it } from "vitest";
import { addVat, extractVat } from "./vat";

describe("extractVat", () => {
  it("takes VAT OUT of a tax-inclusive total", () => {
    // 15/115, not 15/100. Backwards overstates the tax by about 15% of itself —
    // an error an audit finds and a spot-check does not.
    const breakdown = extractVat(115, 15);
    expect(breakdown.net).toBe(100);
    expect(breakdown.vat).toBe(15);
    expect(breakdown.gross).toBe(115);
  });

  it("is not the same as adding 15% — the number that proves it", () => {
    expect(extractVat(100, 15).vat).toBe(13.04);
    expect(addVat(100, 15).vat).toBe(15);
  });

  it("keeps net + vat exactly equal to gross", () => {
    for (const gross of [115, 100, 4200.55, 0.1, 999.99, 1, 2300]) {
      const breakdown = extractVat(gross, 15);
      expect(breakdown.net + breakdown.vat).toBeCloseTo(breakdown.gross, 10);
    }
  });

  it("handles zero", () => {
    expect(extractVat(0, 15)).toEqual({
      net: 0,
      vat: 0,
      gross: 0,
      ratePercent: 15,
    });
  });
});

describe("addVat", () => {
  it("adds the rate to a net figure", () => {
    expect(addVat(100, 15)).toEqual({
      net: 100,
      vat: 15,
      gross: 115,
      ratePercent: 15,
    });
  });

  it("keeps net + vat exactly equal to gross", () => {
    for (const net of [100, 4200.55, 0.1, 33.33]) {
      const breakdown = addVat(net, 15);
      expect(breakdown.net + breakdown.vat).toBeCloseTo(breakdown.gross, 10);
    }
  });
});
