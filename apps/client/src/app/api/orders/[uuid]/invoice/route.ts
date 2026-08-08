import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getInvoicePdf, getUserOrder } from "services";

// The invoice PDF for the web customer. A route handler rather than a Server
// Action because the response is a FILE — an action returns serialisable data,
// and streaming bytes is what a handler is for.
//
// `?download=1` attaches it; without it, it opens inline. One route, two
// buttons.

export const GET = async (
  request: Request,
  context: { params: Promise<{ uuid: string }> },
) => {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { uuid } = await context.params;

  // Scoped by the caller's own uuid. A uuid in a URL is not an authorisation,
  // and this is the most sensitive document the system produces.
  const owned = await getUserOrder(user.uuid, uuid);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = await getInvoicePdf(uuid);
  if (!pdf) {
    return NextResponse.json(
      { error: "No invoice yet" },
      { status: 404 },
    );
  }

  const download = new URL(request.url).searchParams.get("download");

  return new NextResponse(pdf.bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${pdf.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
};
