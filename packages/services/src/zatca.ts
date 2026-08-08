// ---------------------------------------------------------------------------
// ZATCA — the QR code every Saudi tax invoice has to carry.
//
// Cash-only does not exempt anything here. A cash sale is still a taxable
// supply, and the invoice for it still has to be compliant. This is invoice
// GENERATION, not payment processing, which is why it survived the decision to
// drop the gateway.
//
// Phase 1 (the simplified tax invoice) requires five fields, encoded as TLV and
// base64'd into a QR:
//
//   1  seller name
//   2  seller VAT registration number
//   3  timestamp, ISO 8601
//   4  invoice total INCLUDING VAT
//   5  the VAT total
//
// THE BUG THIS FILE EXISTS TO AVOID: the length byte is the length in BYTES of
// the UTF-8 value, not the number of characters. Every seller name in Arabic is
// two or three bytes per character, so a character-counted length produces a QR
// that scans as garbage — and it does so ONLY for Arabic names, which means it
// passes every test written in English and fails in production in Riyadh.
//
// Phase 2 adds a cryptographic stamp, a UUID and a previous-invoice hash for
// direct integration with ZATCA's platform. Not here: it needs credentials and
// an onboarding process, and a half-built stamp is worse than none.
// ---------------------------------------------------------------------------

export type ZatcaSeller = {
  name: string;
  // The 15-digit VAT registration number.
  vatNumber: string;
};

export type ZatcaInvoiceFacts = {
  seller: ZatcaSeller;
  issuedAt: Date;
  // Including VAT.
  totalWithVat: number;
  vatTotal: number;
};

/**
 * One tag-length-value field.
 *
 * Length is measured after encoding, never before. That single ordering is the
 * whole correctness of this file.
 */
const tlv = (tag: number, value: string): Uint8Array => {
  const encoded = new TextEncoder().encode(value);
  if (encoded.length > 255) {
    // A single byte holds the length. Silently truncating would produce a QR
    // that scans and is wrong, which is worse than one that refuses to be made.
    throw new Error(
      `ZATCA field ${tag} is ${encoded.length} bytes; the format allows 255.`,
    );
  }
  const out = new Uint8Array(2 + encoded.length);
  out[0] = tag;
  out[1] = encoded.length;
  out.set(encoded, 2);
  return out;
};

/**
 * Money as ZATCA wants it: a plain decimal with two places, no separators, no
 * currency symbol.
 *
 * Rounded through minor units rather than toFixed on a float, so 0.145 does not
 * become 0.14 on one machine and 0.15 on another.
 */
export const formatZatcaAmount = (value: number): string =>
  (Math.round(value * 100) / 100).toFixed(2);

/**
 * The timestamp format ZATCA expects — ISO 8601, UTC, to the second.
 *
 * Milliseconds are dropped deliberately: the specification's examples carry
 * none, and a scanner comparing against a stored value would not match.
 */
export const formatZatcaTimestamp = (at: Date): string =>
  `${at.toISOString().slice(0, 19)}Z`;

/** The base64 TLV payload that becomes the QR code. */
export const buildZatcaQr = (facts: ZatcaInvoiceFacts): string => {
  const fields = [
    tlv(1, facts.seller.name),
    tlv(2, facts.seller.vatNumber),
    tlv(3, formatZatcaTimestamp(facts.issuedAt)),
    tlv(4, formatZatcaAmount(facts.totalWithVat)),
    tlv(5, formatZatcaAmount(facts.vatTotal)),
  ];

  const total = fields.reduce((sum, field) => sum + field.length, 0);
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const field of fields) {
    buffer.set(field, offset);
    offset += field.length;
  }

  // btoa is byte-oriented, so the string handed to it must be one char per
  // byte — mapping through fromCharCode does that. Passing the original text
  // would re-encode and corrupt every non-ASCII name.
  return btoa(String.fromCharCode(...buffer));
};

export type VatBreakdown = {
  // The taxable amount, excluding VAT.
  net: number;
  vat: number;
  gross: number;
  ratePercent: number;
};

/**
 * Split a VAT-INCLUSIVE total into its parts.
 *
 * Prices in this catalogue are quoted to customers inclusive of VAT, so the tax
 * is extracted rather than added: at 15%, the VAT is total × 15/115, not
 * total × 15/100. Getting that backwards overstates the tax by about 15% of
 * itself, which is the kind of error an audit finds and a spot-check does not.
 *
 * All arithmetic in integer minor units so the three figures add up exactly.
 */
export const extractVat = (
  grossAmount: number,
  ratePercent: number,
): VatBreakdown => {
  const grossMinor = Math.round(grossAmount * 100);
  const vatMinor = Math.round(
    (grossMinor * ratePercent) / (100 + ratePercent),
  );
  return {
    net: (grossMinor - vatMinor) / 100,
    vat: vatMinor / 100,
    gross: grossMinor / 100,
    ratePercent,
  };
};

/**
 * Add VAT to a net amount.
 *
 * The other direction, for a figure quoted excluding tax. Kept beside
 * `extractVat` so the two are read together and nobody reaches for the wrong
 * one.
 */
export const addVat = (
  netAmount: number,
  ratePercent: number,
): VatBreakdown => {
  const netMinor = Math.round(netAmount * 100);
  const vatMinor = Math.round((netMinor * ratePercent) / 100);
  return {
    net: netMinor / 100,
    vat: vatMinor / 100,
    gross: (netMinor + vatMinor) / 100,
    ratePercent,
  };
};

export type ZatcaProblem = string;

/**
 * What is missing before an invoice can legally be issued.
 *
 * Returned as a list rather than thrown one at a time: whoever is configuring
 * this is setting up a company, and finding out about one missing field per
 * attempt is a bad afternoon.
 */
export const zatcaProblems = (seller: Partial<ZatcaSeller>): ZatcaProblem[] => {
  const problems: ZatcaProblem[] = [];
  if (!seller.name || seller.name.trim() === "") {
    problems.push("The seller's registered name is not set.");
  }
  const vat = seller.vatNumber?.trim() ?? "";
  if (vat === "") {
    problems.push("The seller's VAT registration number is not set.");
  } else if (!/^\d{15}$/.test(vat)) {
    problems.push(
      "A Saudi VAT registration number is exactly 15 digits.",
    );
  } else if (!vat.startsWith("3") || !vat.endsWith("3")) {
    // ZATCA issues numbers beginning and ending with 3. Worth checking: a
    // transposed or truncated number passes a length test and fails an audit.
    problems.push(
      "A Saudi VAT registration number starts and ends with 3.",
    );
  }
  return problems;
};
