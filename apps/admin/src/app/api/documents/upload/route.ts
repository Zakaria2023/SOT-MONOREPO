import { forbidNonAdmin } from "@/lib/server/auth";
import { handleDocumentUpload } from "storage";

// Staff-only. Middleware proves there is a session; only this proves it is a
// staff one, and an open upload endpoint is somewhere to park anything.
export const POST = async (request: Request) =>
  (await forbidNonAdmin()) ?? handleDocumentUpload(request);
