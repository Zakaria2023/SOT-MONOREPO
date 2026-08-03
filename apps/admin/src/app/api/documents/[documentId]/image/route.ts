import { isPublicDocument } from "services";
import { handleDocumentImage } from "storage";

/**
 * Exempt from auth in proxy.ts so next/image's optimizer can fetch it
 * server-side, which means it is reachable without a session and must gate
 * itself. Staff who need a private document use the download route next door,
 * which stays behind auth.
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
