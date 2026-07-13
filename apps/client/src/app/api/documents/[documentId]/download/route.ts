import { handleDocumentDownload } from "storage";

export const GET = (
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) => handleDocumentDownload(request, context);
