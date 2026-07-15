import { handleDocumentDelete } from "storage";

export const DELETE = (
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) => handleDocumentDelete(request, context);
