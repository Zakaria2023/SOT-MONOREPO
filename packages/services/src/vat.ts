// ---------------------------------------------------------------------------
// VAT.
//
// What survives of the ZATCA module after the QR and the registration checks
// were dropped. This part was never really ZATCA-specific — an invoice with a
// total and no tax line is not an invoice anywhere — so it stays, and the
// Saudi-specific machinery is gone.
//
// THE ONE THING TO GET RIGHT: prices in this catalogue are quoted to customers
// INCLUSIVE of tax, so the VAT is extracted from the total rather than added to
// it. At 15% that is total × 15/115, not total × 15/100. Backwards overstates
// the tax by about 15% of itself — an error an audit finds and a spot-check does
// not.
// ---------------------------------------------------------------------------

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
 * All arithmetic in integer minor units, so the three figures add up exactly
 * rather than to 2299.9999999.
 */
export const extractVat = (
  grossAmount: number,
  ratePercent: number,
): VatBreakdown => {
  const grossMinor = Math.round(grossAmount * 100);
  const vatMinor = Math.round((grossMinor * ratePercent) / (100 + ratePercent));
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
