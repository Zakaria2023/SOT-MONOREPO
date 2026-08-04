import { forbidNonAdmin } from "@/lib/server/auth";
import { handleDocumentDelete } from "storage";

// Staff-only. Destructive and keyed only by a uuid, so a session alone was never
// enough to authorise it.
export const DELETE = async (
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) => (await forbidNonAdmin()) ?? handleDocumentDelete(request, context);
