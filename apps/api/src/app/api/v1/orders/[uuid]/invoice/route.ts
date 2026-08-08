import { getUserFromRequest, unauthorized } from "@/lib/helpers";
import { NextResponse } from "next/server";
import { getInvoicePdf, getUserOrder } from "services";

/**
 * The invoice, as a PDF.
 *
 * `?download=1` attaches it; without it the browser opens it inline. That is the
 * whole difference between the two buttons, and it belongs in the header rather
 * than in two routes.
 *
 * Ownership is checked through getUserOrder, which scopes by the caller's own
 * uuid — an invoice is the most sensitive document this system produces, and a
 * uuid in a URL is not an authorisation.
 */
export const GET = async (
  request: Request,
  context: { params: Promise<{ uuid: string }> },
) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  const { uuid } = await context.params;

  const owned = await getUserOrder(user.uuid, uuid);
  if (!owned) {
    // Not found rather than forbidden: telling a stranger that an order exists
    // but is not theirs is itself a disclosure.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = await getInvoicePdf(uuid);
  if (!pdf) {
    return NextResponse.json(
      { error: "No invoice has been issued for this order yet." },
      { status: 404 },
    );
  }

  const download = new URL(request.url).searchParams.get("download");

  return new NextResponse(pdf.bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${pdf.fileName}"`,
      // Never cached by a shared cache: this is one person's financial document.
      "Cache-Control": "private, no-store",
    },
  });
};
