import { handleDocumentImage } from "storage";

export const GET = (
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) => handleDocumentImage(request, context);
