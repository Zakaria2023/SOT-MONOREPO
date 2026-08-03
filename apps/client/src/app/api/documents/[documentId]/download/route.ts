import { isPublicDocument } from "services";
import { handleDocumentDownload } from "storage";

/**
 * Public, so it is limited to public assets — datasheets and product photos.
 * See the image route next door for why the check has to look up the referencing
 * column, and why a private id gets a 404 rather than a 403.
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
