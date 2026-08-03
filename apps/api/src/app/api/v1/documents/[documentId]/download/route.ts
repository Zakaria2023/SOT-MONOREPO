import { isPublicDocument } from "services";
import { handleDocumentDownload } from "storage";

/**
 * Public, and limited to public assets.
 *
 * The mobile app loads product photos through here without a session, which is
 * correct — a shopper browses before signing in. What was not correct is that it
 * served ANY document to anyone holding its uuid, the same hole the storefront
 * had: partner and user CR/VAT certificates are stored as documents too.
 *
 * 404 rather than 403, so a wrong guess and a real private document look the same.
 * A 403 confirms the id exists.
 */
export const GET = async (
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) => {
  const { documentId } = await context.params;

  if (!(await isPublicDocument(documentId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return handleDocumentDownload(request, context);
};
