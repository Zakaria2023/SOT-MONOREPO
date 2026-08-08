import type { TaxInvoice } from "./invoicing";

// ---------------------------------------------------------------------------
// THE INVOICE, AS A PDF.
//
// Written by hand rather than with a library, and that is a real decision worth
// defending. The alternatives were a headless browser (a Chromium per request,
// on a serverless host) or a layout library (a dependency, a font pipeline, and
// a bundle). This document is one page of left-aligned text with a table and a
// total — the least amount of PDF that exists — so it is emitted directly.
//
// What that costs: Helvetica only, no images, no Arabic. Arabic matters here and
// is NOT solved by pretending — WinAnsi cannot encode it, so any non-Latin
// character is replaced rather than silently mangled into wingdings. When the
// invoice needs Arabic it needs an embedded font, and that is the moment to
// bring in a library rather than grow this file.
//
// Everything is measured in points from the BOTTOM-LEFT, which is PDF's origin
// and the source of every off-by-a-page-height mistake in this kind of code.
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595; // A4 at 72dpi
const PAGE_HEIGHT = 842;
const MARGIN = 56;

/**
 * Escape a string for a PDF literal.
 *
 * Backslashes and brackets end the literal early; anything outside WinAnsi
 * cannot be represented in the base font at all. Replaced with "?" rather than
 * dropped, so a name that could not be printed leaves a visible gap instead of
 * quietly shortening.
 */
const pdfText = (value: string): string =>
  [...value]
    .map((char) => {
      const code = char.codePointAt(0) ?? 63;
      if (char === "\\" || char === "(" || char === ")") {
        return `\\${char}`;
      }
      return code > 255 ? "?" : char;
    })
    .join("");

type Line = { x: number; y: number; size: number; bold: boolean; text: string };

const draw = (lines: Line[]): string =>
  lines
    .map(
      (line) =>
        `BT /${line.bold ? "F2" : "F1"} ${line.size} Tf ${line.x} ${line.y} Td (${pdfText(line.text)}) Tj ET`,
    )
    .join("\n");

const money = (value: number, currency: string): string =>
  `${currency} ${value.toFixed(2)}`;

/**
 * Lay the invoice out and emit the file.
 *
 * Returns bytes rather than a string: a PDF is binary, and a Node string would
 * be re-encoded on the way to the response and corrupt the byte offsets in the
 * cross-reference table.
 */
export const renderInvoicePdf = (invoice: TaxInvoice): Uint8Array => {
  const right = PAGE_WIDTH - MARGIN;
  const lines: Line[] = [];
  let y = PAGE_HEIGHT - MARGIN;

  const write = (text: string, size = 10, bold = false, x = MARGIN): void => {
    lines.push({ x, y, size, bold, text });
  };
  const down = (points: number): void => {
    y -= points;
  };

  write("INVOICE", 20, true);
  down(28);
  write(invoice.number, 12, true);
  down(16);
  write(`Issued ${new Date(invoice.issuedAt).toLocaleDateString("en-GB")}`, 9);
  down(30);

  write("From", 9, true);
  down(14);
  write(invoice.seller.name, 10);
  down(13);
  if (invoice.seller.vatNumber) {
    // Printed when set, omitted when not — it no longer gates issuing.
    write(`VAT ${invoice.seller.vatNumber}`, 9);
    down(13);
  }
  down(12);

  write("To", 9, true);
  down(14);
  write(invoice.buyerName ?? "Customer", 10);
  down(30);

  // Column heads. Right-aligned columns are positioned by their right edge and
  // nudged left by an estimate of the text width — Helvetica averages about 0.5em
  // per character at these sizes, which is close enough for a two-column table
  // and wrong enough that anything wider needs real metrics.
  const rightAt = (text: string, size: number): number =>
    right - text.length * size * 0.5;

  write("Description", 9, true);
  write("Qty", 9, true, right - 170);
  write("Unit", 9, true, right - 120);
  const totalHead = "Amount";
  write(totalHead, 9, true, rightAt(totalHead, 9));
  down(6);
  lines.push({ x: MARGIN, y, size: 1, bold: false, text: "" });
  down(14);

  for (const line of invoice.lines) {
    const amount = money(line.lineTotal, invoice.currency);
    write(line.name.slice(0, 44), 10);
    write(String(line.quantity), 10, false, right - 170);
    write(line.unitPrice.toFixed(2), 10, false, right - 120);
    write(amount, 10, false, rightAt(amount, 10));
    down(16);
  }

  down(18);
  const rows: [string, string, boolean][] = [
    ["Subtotal", money(invoice.net, invoice.currency), false],
    [
      `VAT (${invoice.vatRatePercent}%)`,
      money(invoice.vat, invoice.currency),
      false,
    ],
    ["Total", money(invoice.total, invoice.currency), true],
  ];
  for (const [label, value, bold] of rows) {
    write(label, bold ? 12 : 10, bold, right - 200);
    write(value, bold ? 12 : 10, bold, rightAt(value, bold ? 12 : 10));
    down(bold ? 22 : 16);
  }

  const content = draw(lines);
  const encoder = new TextEncoder();

  // Objects are assembled in order and their byte offsets recorded as we go —
  // the xref table at the end is a list of those offsets, and a reader that
  // cannot find them will not open the file.
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;

  return encoder.encode(pdf);
};

/** The filename a browser should save it as. */
export const invoicePdfName = (invoice: TaxInvoice): string =>
  `${invoice.number}.pdf`;
