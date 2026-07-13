import { handleDocumentUpload } from "storage";

export const POST = (request: Request) => handleDocumentUpload(request);
