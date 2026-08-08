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
import {
  buildZatcaQr,
  extractVat,
  zatcaProblems,
  type ZatcaSeller,
} from "./zatca";

export type { SelectInvoices };

// ---------------------------------------------------------------------------
// ISSUING A TAX INVOICE.
//
// Cash-only exempts nothing. A cash sale is a taxable supply and its invoice
// still has to carry the seller's registration, the VAT split and the QR. This
// is invoice generation, not payment processing, which is why it stayed in when
// the gateway went out.
//
// The seller's details come from configuration and are SNAPSHOTTED onto every
// invoice. A company can be renamed or re-registered, and a reprint has to match
// the paper the customer is holding — recomputing from today's configuration
// would silently restate history.
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
  seller: ZatcaSeller;
  buyerName: string | null;
  lines: InvoiceLine[];
  net: number;
  vat: number;
  vatRatePercent: number;
  total: number;
  // Base64 TLV. The QR image is rendered from this by whatever surface shows it.
  qr: string;
};

/**
 * Who we are, for tax purposes.
 *
 * Read from the environment rather than a table: it is one row that changes
 * almost never, and a settings screen for it would be a screen nobody visits
 * guarding a value nobody may change casually.
 */
export const getSeller = (): Partial<ZatcaSeller> => ({
  name: process.env.ZATCA_SELLER_NAME,
  vatNumber: process.env.ZATCA_SELLER_VAT_NUMBER,
});

/**
 * Whether this deployment can legally issue an invoice at all.
 *
 * Surfaced rather than discovered at the moment of a sale: finding out the VAT
 * number is missing while a customer waits is the worst possible time.
 */
export const invoicingProblems = (): string[] => zatcaProblems(getSeller());

const assertSeller = (): ZatcaSeller => {
  const seller = getSeller();
  const problems = zatcaProblems(seller);
  if (problems.length > 0 || !seller.name || !seller.vatNumber) {
    throw new ValidationError(
      `This invoice cannot be issued: ${problems.join(" ")}`,
    );
  }
  return { name: seller.name, vatNumber: seller.vatNumber };
};

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
  const seller = assertSeller();

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

  const qr = buildZatcaQr({
    seller,
    issuedAt,
    totalWithVat: breakdown.gross,
    vatTotal: breakdown.vat,
  });

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
    zatcaQr: qr,
    issuedAt,
  });

  const [created] = await db
    .select()
    .from(Invoices)
    .where(eq(Invoices.uuid, uuid));
  return created;
};

/**
 * An invoice as it should be printed.
 *
 * Built entirely from what was STORED at issue — the seller, the rate, the QR —
 * never from today's configuration. A reprint has to be identical to the
 * original or it is not a reprint.
 */
export const getTaxInvoice = async (
  orderUuid: string,
): Promise<TaxInvoice | null> => {
  const [invoice] = await db
    .select()
    .from(Invoices)
    .where(eq(Invoices.orderUuid, orderUuid));
  if (!invoice) {
    return null;
  }

  // The buyer's name is joined from Users rather than snapshotted, because a
  // customer correcting their own name should see it corrected on their invoice.
  // The SELLER is snapshotted, because that one is a legal identity at a moment
  // in time — the asymmetry is deliberate.
  const [items, [order]] = await Promise.all([
    db.select().from(OrderItems).where(eq(OrderItems.orderUuid, orderUuid)),
    db
      .select({ buyerName: Users.fullName })
      .from(Orders)
      .leftJoin(Users, eq(Users.uuid, Orders.userUuid))
      .where(eq(Orders.uuid, orderUuid)),
  ]);

  return {
    number: invoice.number,
    issuedAt: invoice.issuedAt,
    currency: invoice.currency ?? "SAR",
    seller: {
      name: invoice.sellerName ?? "",
      vatNumber: invoice.sellerVatNumber ?? "",
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
    qr: invoice.zatcaQr ?? "",
  };
};
