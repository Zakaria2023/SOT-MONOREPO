import { describe, expect, it } from "vitest";
import {
  capitalize,
  formatMoney,
  formatPrice,
  formatSar,
  fromMinorUnits,
  getInitials,
  getReviewerName,
  lineTotal,
  offerTotal,
  slugify,
  splitFullName,
  summarizeCart,
  toMinorUnits,
} from "./index";

describe("formatMoney", () => {
  it("formats whole amounts with thousands separators", () => {
    expect(formatMoney(17768, "SAR")).toBe("SAR 17,768");
  });

  it("rounds to whole units", () => {
    expect(formatMoney(1234.56, "USD")).toBe("USD 1,235");
  });

  it("defaults to SAR when currency is null", () => {
    expect(formatMoney(1000, null)).toBe("SAR 1,000");
  });
});

describe("formatSar", () => {
  it("prefixes SAR and rounds", () => {
    expect(formatSar(84200)).toBe("SAR 84,200");
    expect(formatSar(1234.5)).toBe("SAR 1,235");
  });
});

describe("formatPrice", () => {
  it("keeps the fractional part of a decimal string", () => {
    expect(formatPrice("4200.5", "SAR")).toBe("SAR 4,200.5");
  });

  it("defaults currency to SAR", () => {
    expect(formatPrice("4200", null)).toBe("SAR 4,200");
  });

  it("falls back to a label when the price is unset", () => {
    expect(formatPrice(null, "SAR")).toBe("Price on request");
  });
});

describe("toMinorUnits / fromMinorUnits", () => {
  it("parses decimal strings to integer minor units", () => {
    expect(toMinorUnits("4200.55")).toBe(420055);
    expect(toMinorUnits(0.1)).toBe(10);
  });

  it("round-trips back to major units", () => {
    expect(fromMinorUnits(420055)).toBe(4200.55);
  });
});

describe("lineTotal", () => {
  it("multiplies exactly, avoiding float drift", () => {
    // 0.1 * 3 === 0.30000000000000004 with naive float math
    expect(lineTotal("0.10", 3)).toBe(0.3);
  });

  it("handles whole prices and quantities", () => {
    expect(lineTotal("4200.00", 2)).toBe(8400);
  });
});

describe("summarizeCart", () => {
  it("sums without floating-point drift", () => {
    // Naive 0.1 summed ten times is 0.9999999999999999
    const lines = Array.from({ length: 10 }, () => ({
      unitPrice: "0.10",
      quantity: 1,
    }));
    expect(summarizeCart(lines).subtotal).toBe(1);
  });

  it("computes 15% VAT and total", () => {
    const { subtotal, vat, total } = summarizeCart([
      { unitPrice: "100.00", quantity: 2 },
    ]);
    expect(subtotal).toBe(200);
    expect(vat).toBe(30);
    expect(total).toBe(230);
  });

  it("rounds VAT to the halala exactly once", () => {
    // subtotal 30 halalas -> VAT round(30 * 15 / 100) = round(4.5) = 5 halalas
    const { vat } = summarizeCart([{ unitPrice: "0.10", quantity: 3 }]);
    expect(vat).toBe(0.05);
  });

  it("returns zeros for an empty cart", () => {
    expect(summarizeCart([])).toEqual({ subtotal: 0, vat: 0, total: 0 });
  });

  it("treats an unpriced line as zero", () => {
    const { subtotal, vat, total } = summarizeCart([
      { unitPrice: null, quantity: 3 },
      { unitPrice: "100.00", quantity: 1 },
    ]);
    expect(subtotal).toBe(100);
    expect(vat).toBe(15);
    expect(total).toBe(115);
  });
});

describe("offerTotal", () => {
  it("sums product, install, and programming prices", () => {
    expect(
      offerTotal({
        productPrice: "1000",
        installPrice: "200",
        programmingPrice: "50",
      }),
    ).toBe(1250);
  });

  it("treats a null programming price as zero", () => {
    expect(
      offerTotal({
        productPrice: "1000",
        installPrice: "200",
        programmingPrice: null,
      }),
    ).toBe(1200);
  });
});

describe("capitalize", () => {
  it("uppercases the first letter", () => {
    expect(capitalize("published")).toBe("Published");
  });

  it("leaves an empty string unchanged", () => {
    expect(capitalize("")).toBe("");
  });
});

describe("getInitials", () => {
  it("takes the first and last initials", () => {
    expect(getInitials("Zakaria Asad")).toBe("ZA");
  });

  it("handles a single name", () => {
    expect(getInitials("madonna")).toBe("M");
  });

  it("falls back to ? for blank input", () => {
    expect(getInitials("   ")).toBe("?");
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Product Name")).toBe("product-name");
  });

  it("collapses non-alphanumerics and trims stray hyphens", () => {
    expect(slugify("  Wi-Fi & Routers!! ")).toBe("wi-fi-routers");
  });
});

describe("splitFullName", () => {
  it("splits into first and last", () => {
    expect(splitFullName("Abdullah Al Mutairi")).toEqual({
      firstName: "Abdullah",
      lastName: "Al Mutairi",
    });
  });

  it("leaves lastName undefined for a single token", () => {
    expect(splitFullName("Madonna")).toEqual({
      firstName: "Madonna",
      lastName: undefined,
    });
  });
});

describe("getReviewerName", () => {
  it("prefers the full name", () => {
    expect(
      getReviewerName({
        id: "u1",
        fullName: "Jane Doe",
        primaryEmailAddress: { emailAddress: "j@x.com" },
      }),
    ).toBe("Jane Doe");
  });

  it("falls back to email, then id", () => {
    expect(
      getReviewerName({
        id: "u1",
        fullName: "   ",
        primaryEmailAddress: { emailAddress: "j@x.com" },
      }),
    ).toBe("j@x.com");
    expect(
      getReviewerName({ id: "u1", fullName: null, primaryEmailAddress: null }),
    ).toBe("u1");
    expect(getReviewerName(null)).toBeUndefined();
  });
});
