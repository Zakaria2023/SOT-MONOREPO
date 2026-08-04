import { forbidNonAdmin } from "@/lib/server/auth";
import { handleDocumentDownload } from "storage";

// Staff-only, and deliberately NOT limited to public assets: reviewing a
// partner's CR certificate is the job. That is exactly why it needs the role
// check — this is the one document route that will hand over anything.
export const GET = async (
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) => (await forbidNonAdmin()) ?? handleDocumentDownload(request, context);
