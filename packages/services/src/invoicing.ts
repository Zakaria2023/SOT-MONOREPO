import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { OrderItems } from "../../../db/schema/order-items";
import {
  Invoices,
  Orders,
  type SelectInvoices,
} from "../../../db/schema/orders";
import { Users } from "../../../db/schema/users";
import { ValidationError } from "./errors";
import { generateUuid } from "utils";

// `storage` imports `server-only`, which throws the moment it appears in a
// module graph outside a server context. Importing it statically here would put
// that edge on every file that imports from `services` — including client
// components, which import types from this package all day. So it is loaded
// lazily, inside the two functions that touch R2.
const storage = () => import("storage");
import { invoicePdfName, renderInvoicePdf } from "./invoice-pdf";
import { extractVat } from "./vat";

export type { SelectInvoices };

// ---------------------------------------------------------------------------
// ISSUING AN INVOICE.
//
// The ZATCA QR and the VAT-registration checks were removed on request. What
// remains is the part that is true of any invoice: who sold it, what was bought,
// and how the total splits into net and tax. A document with a total and no tax
// line is not an invoice anywhere.
//
// NOTE FOR WHOEVER PICKS THIS UP: a Saudi tax invoice legally requires the ZATCA
// QR. It was built, tested and byte-correct for Arabic seller names, and it was
// taken out deliberately rather than lost — the commit that removed it has the
// whole implementation if it needs to come back.
//
// The seller's details are still SNAPSHOTTED onto every invoice. A company can be
// renamed, and a reprint has to match the paper the customer is holding —
// recomputing from today's configuration would silently restate history.
// ---------------------------------------------------------------------------

// Prices in this catalogue are quoted to customers inclusive of tax, so the VAT
// is EXTRACTED from the total rather than added to it.
const VAT_RATE_PERCENT = 15;

export type InvoiceLine = {
  name: string;
  quantity: number;
  // Inclusive of VAT, as quoted.
  unitPrice: number;
  lineTotal: number;
};

export type TaxInvoice = {
  number: SelectInvoices["number"];
  issuedAt: SelectInvoices["issuedAt"];
  currency: string;
  seller: InvoiceSeller;
  buyerName: string | null;
  lines: InvoiceLine[];
  net: number;
  vat: number;
  vatRatePercent: number;
  total: number;
};

export type InvoiceSeller = {
  name: string;
  vatNumber: string | null;
};

/**
 * Who we are, on the invoice.
 *
 * No longer gates issuing. The VAT number is printed when it is set and omitted
 * when it is not — a missing registration is no longer a reason to refuse a
 * customer their invoice, which is what removing ZATCA means in practice.
 */
export const getSeller = (): InvoiceSeller => ({
  name: process.env.INVOICE_SELLER_NAME ?? "SOT Solutions",
  vatNumber: process.env.INVOICE_SELLER_VAT_NUMBER || null,
});

/**
 * Issue the tax invoice for an order.
 *
 * Idempotent by the invoice row: an order already invoiced returns what it was
 * given the first time rather than issuing a second number for the same supply,
 * which would be a genuine compliance problem rather than an inconvenience.
 */
export const issueInvoice = async (
  orderUuid: string,
): Promise<SelectInvoices> => {
  const seller = getSeller();

  const [existing] = await db
    .select()
    .from(Invoices)
    .where(eq(Invoices.orderUuid, orderUuid));
  if (existing) {
    return existing;
  }

  const [order] = await db
    .select()
    .from(Orders)
    .where(eq(Orders.uuid, orderUuid));
  if (!order) {
    throw new ValidationError("That order no longer exists.");
  }

  const gross = Number(order.grandTotal);
  const breakdown = extractVat(gross, VAT_RATE_PERCENT);
  const issuedAt = new Date();

  const number = `INV-${order.reference.replace(/^ORD-/, "")}`;
  const uuid = crypto.randomUUID();

  await db.insert(Invoices).values({
    uuid,
    number,
    orderUuid,
    amount: breakdown.gross.toFixed(2),
    currency: order.currency ?? "SAR",
    netAmount: breakdown.net.toFixed(2),
    vatAmount: breakdown.vat.toFixed(2),
    vatRatePercent: VAT_RATE_PERCENT,
    sellerName: seller.name,
    sellerVatNumber: seller.vatNumber,
    issuedAt,
  });

  const [created] = await db
    .select()
    .from(Invoices)
    .where(eq(Invoices.uuid, uuid));

  // Rendered and stored ONCE, in Cloudflare R2, alongside every other document
  // this system keeps. An invoice is an artifact rather than a view: re-rendering
  // it on each request means improving the layout next month silently changes
  // every invoice a customer already holds.
  //
  // Failure here does not fail the issue. The invoice row is the record; the PDF
  // is a rendering of it, and the reader falls back to rendering on demand. An
  // R2 outage must not be the reason a paid order has no invoice.
  try {
    const documentId = generateUuid();
    const { uploadDocument } = await storage();
    await uploadDocument({
      documentId,
      body: Buffer.from(renderInvoicePdf(await buildTaxInvoice(created))),
      contentType: "application/pdf",
    });
    await db
      .update(Invoices)
      .set({ pdfDocumentId: documentId })
      .where(eq(Invoices.uuid, uuid));
    return { ...created, pdfDocumentId: documentId };
  } catch (error) {
    console.error("Storing the invoice PDF failed:", error);
    return created;
  }
};

/**
 * An invoice row turned into the document it represents.
 *
 * Built entirely from what was STORED at issue — the seller, the rate — never
 * from today's configuration. A reprint has to be identical to the paper the
 * customer holds or it is not a reprint.
 *
 * Split out from `getTaxInvoice` so issuing can render the PDF from the row it
 * just wrote without reading it back through a second query.
 */
export const buildTaxInvoice = async (
  invoice: SelectInvoices,
): Promise<TaxInvoice> => {
  // The buyer's name is joined live rather than snapshotted, because a customer
  // correcting their own name should see it corrected. The SELLER is
  // snapshotted, because that one is a legal identity at a moment in time — the
  // asymmetry is deliberate.
  const [items, [order]] = await Promise.all([
    db
      .select()
      .from(OrderItems)
      .where(eq(OrderItems.orderUuid, invoice.orderUuid)),
    db
      .select({ buyerName: Users.fullName })
      .from(Orders)
      .leftJoin(Users, eq(Users.uuid, Orders.userUuid))
      .where(eq(Orders.uuid, invoice.orderUuid)),
  ]);

  return {
    number: invoice.number,
    issuedAt: invoice.issuedAt,
    currency: invoice.currency ?? "SAR",
    seller: {
      name: invoice.sellerName ?? "",
      vatNumber: invoice.sellerVatNumber,
    },
    buyerName: order?.buyerName ?? null,
    lines: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
    net: Number(invoice.netAmount ?? 0),
    vat: Number(invoice.vatAmount ?? 0),
    vatRatePercent: invoice.vatRatePercent ?? VAT_RATE_PERCENT,
    total: Number(invoice.amount),
  };
};

/** The invoice for an order, ready to print. */
export const getTaxInvoice = async (
  orderUuid: string,
): Promise<TaxInvoice | null> => {
  const [invoice] = await db
    .select()
    .from(Invoices)
    .where(eq(Invoices.orderUuid, orderUuid));
  return invoice ? buildTaxInvoice(invoice) : null;
};

/**
 * The stored PDF, or a freshly rendered one.
 *
 * Prefers what was written to R2 at issue, so what a customer downloads today is
 * byte-identical to what they downloaded last year. Falls back to rendering for
 * an invoice issued before the PDF was stored, and for the case where the upload
 * failed — neither is a reason to deny somebody their invoice.
 */
export const getInvoicePdf = async (
  orderUuid: string,
): Promise<{ bytes: Uint8Array; fileName: string } | null> => {
  const [invoice] = await db
    .select()
    .from(Invoices)
    .where(eq(Invoices.orderUuid, orderUuid));
  if (!invoice) {
    return null;
  }

  const document = await buildTaxInvoice(invoice);
  const fileName = invoicePdfName(document);

  if (invoice.pdfDocumentId) {
    // The whole read is guarded, not just the fetch. `readDocument` catches its
    // own S3 errors, but the dynamic import can itself fail — a missing binding,
    // a bad build, `server-only` outside a server context — and an unguarded
    // import would throw past the fallback that exists precisely so this cannot
    // deny somebody their invoice.
    try {
      const { readDocument } = await storage();
      const stored = await readDocument(invoice.pdfDocumentId);
      if (stored) {
        return { bytes: stored, fileName };
      }
      // Id present, object missing. Logged rather than thrown: the customer still
      // gets a correct invoice, and somebody needs to know the bucket lost one.
      console.error(
        `Invoice ${invoice.number} points at missing R2 object ${invoice.pdfDocumentId}`,
      );
    } catch (error) {
      console.error(`Reading the stored invoice PDF failed:`, error);
    }
  }

  return { bytes: renderInvoicePdf(document), fileName };
};
