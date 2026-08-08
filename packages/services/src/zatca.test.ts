import { describe, expect, it } from "vitest";
import {
  addVat,
  buildZatcaQr,
  extractVat,
  formatZatcaAmount,
  formatZatcaTimestamp,
  zatcaProblems,
} from "./zatca";

const SELLER = { name: "SOT Solutions", vatNumber: "310122393500003" };
const AT = new Date("2026-08-08T10:30:00.000Z");

// Decode a base64 TLV payload back into its fields, so the tests assert what a
// scanner would actually read rather than a string this file produced.
const decode = (payload: string): { tag: number; value: string }[] => {
  const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
  const fields: { tag: number; value: string }[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const tag = bytes[offset];
    const length = bytes[offset + 1];
    const value = new TextDecoder().decode(
      bytes.slice(offset + 2, offset + 2 + length),
    );
    fields.push({ tag, value });
    offset += 2 + length;
  }
  return fields;
};

describe("buildZatcaQr", () => {
  it("carries the five required fields in order", () => {
    const fields = decode(
      buildZatcaQr({
        seller: SELLER,
        issuedAt: AT,
        totalWithVat: 1150,
        vatTotal: 150,
      }),
    );
    expect(fields.map((field) => field.tag)).toEqual([1, 2, 3, 4, 5]);
    expect(fields[0].value).toBe("SOT Solutions");
    expect(fields[1].value).toBe("310122393500003");
    expect(fields[2].value).toBe("2026-08-08T10:30:00Z");
    expect(fields[3].value).toBe("1150.00");
    expect(fields[4].value).toBe("150.00");
  });

  it("measures an Arabic name in BYTES, not characters", () => {
    // The bug this file exists to avoid. Arabic is two bytes per character, so a
    // character-counted length yields a QR that scans as garbage — and only for
    // Arabic sellers, so it passes every English test and fails in Riyadh.
    const arabic = "شركة سوت";
    const payload = buildZatcaQr({
      seller: { name: arabic, vatNumber: SELLER.vatNumber },
      issuedAt: AT,
      totalWithVat: 100,
      vatTotal: 13.04,
    });
    const fields = decode(payload);
    expect(fields[0].value).toBe(arabic);
    // 8 characters, 15 bytes — the two must not be confused.
    expect([...arabic].length).toBe(8);
    expect(new TextEncoder().encode(arabic).length).toBe(15);
  });

  it("survives a round trip for a mixed-script name", () => {
    const name = "SOT حلول";
    const fields = decode(
      buildZatcaQr({
        seller: { name, vatNumber: SELLER.vatNumber },
        issuedAt: AT,
        totalWithVat: 1,
        vatTotal: 0.13,
      }),
    );
    expect(fields[0].value).toBe(name);
  });

  it("refuses a field too long for a single length byte", () => {
    // Truncating would produce a QR that scans and is wrong, which is worse than
    // one that refuses to be made.
    expect(() =>
      buildZatcaQr({
        seller: { name: "م".repeat(200), vatNumber: SELLER.vatNumber },
        issuedAt: AT,
        totalWithVat: 1,
        vatTotal: 0,
      }),
    ).toThrow(/255/);
  });
});

describe("formatZatcaTimestamp", () => {
  it("is ISO 8601 UTC to the second, with no milliseconds", () => {
    expect(formatZatcaTimestamp(new Date("2026-08-08T10:30:00.123Z"))).toBe(
      "2026-08-08T10:30:00Z",
    );
  });
});

describe("formatZatcaAmount", () => {
  it("always has two decimal places", () => {
    expect(formatZatcaAmount(1150)).toBe("1150.00");
    expect(formatZatcaAmount(0)).toBe("0.00");
    expect(formatZatcaAmount(0.5)).toBe("0.50");
  });

  it("is exact for the two-decimal amounts it is actually given", () => {
    // Every figure reaching this function comes from a decimal(12,2) column or
    // from integer minor-unit arithmetic, so it is already exact to two places.
    expect(formatZatcaAmount(4200.55)).toBe("4200.55");
    expect(formatZatcaAmount(13.04)).toBe("13.04");
    expect(formatZatcaAmount(999.99)).toBe("999.99");
  });

  it("does not invent precision a double cannot hold", () => {
    // 0.145 is stored as 0.14499999999999999, so it rounds down — and that is
    // the arithmetically honest answer for the value that exists, not a bug.
    // Noted rather than worked around: chasing the decimal ideal here would mean
    // parsing strings, and the inputs are already two-decimal by construction.
    expect(formatZatcaAmount(0.145)).toBe("0.14");
  });

  it("carries no separators or symbols", () => {
    expect(formatZatcaAmount(1234567.89)).toBe("1234567.89");
  });
});

describe("extractVat", () => {
  it("takes VAT OUT of a tax-inclusive total", () => {
    // 15/115, not 15/100. Getting it backwards overstates the tax by about 15%
    // of itself — an error an audit finds and a spot-check does not.
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
    for (const gross of [115, 100, 4200.55, 0.1, 999.99, 1]) {
      const breakdown = extractVat(gross, 15);
      expect(breakdown.net + breakdown.vat).toBeCloseTo(breakdown.gross, 10);
    }
  });

  it("handles zero without dividing by anything awkward", () => {
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
    const breakdown = addVat(100, 15);
    expect(breakdown.net).toBe(100);
    expect(breakdown.vat).toBe(15);
    expect(breakdown.gross).toBe(115);
  });

  it("keeps net + vat exactly equal to gross", () => {
    for (const net of [100, 4200.55, 0.1, 33.33]) {
      const breakdown = addVat(net, 15);
      expect(breakdown.net + breakdown.vat).toBeCloseTo(breakdown.gross, 10);
    }
  });
});

describe("zatcaProblems", () => {
  it("is quiet for a valid seller", () => {
    expect(zatcaProblems(SELLER)).toEqual([]);
  });

  it("names everything missing at once", () => {
    expect(zatcaProblems({})).toHaveLength(2);
  });

  it("rejects a VAT number of the wrong length", () => {
    expect(zatcaProblems({ ...SELLER, vatNumber: "31012239350000" })).toEqual([
      "A Saudi VAT registration number is exactly 15 digits.",
    ]);
  });

  it("rejects one that does not start and end with 3", () => {
    // A transposed or truncated number passes a length check and fails an audit.
    expect(
      zatcaProblems({ ...SELLER, vatNumber: "410122393500004" }),
    ).toEqual(["A Saudi VAT registration number starts and ends with 3."]);
  });

  it("rejects letters", () => {
    expect(
      zatcaProblems({ ...SELLER, vatNumber: "31012239350000X" }).length,
    ).toBeGreaterThan(0);
  });
});
