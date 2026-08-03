import { isPublicDocument } from "services";
import { handleDocumentImage } from "storage";

/**
 * Public, so it serves only assets a visitor is meant to see.
 *
 * There is no Documents table — an id is a bare uuid in someone else's column —
 * so the only way to know whether a document is public is to ask which column
 * points at it. Without that check this route handed over any document to anyone
 * holding its uuid, and partner registration papers and payout invoices are
 * stored the same way as product photos.
 *
 * 404, not 403: a wrong guess and a private document should be indistinguishable,
 * or the response itself confirms the id exists.
 */
export const GET = async (
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) => {
  const { documentId } = await context.params;

  if (!(await isPublicDocument(documentId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return handleDocumentImage(request, context);
};
