import { generateUuid } from "utils";
import {
  isAllowedDocumentType,
  isAllowedImageType,
  MAX_DOCUMENT_SIZE_BYTES,
  uploadDocument,
} from "storage";

// Uploads a document (e.g. a facility's CR / VAT certificate) to R2 and returns
// its id. A Route Handler by necessity — it receives a multipart file body. The
// client stores the returned documentId on the profile.
export const POST = async (req: Request) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (!isAllowedDocumentType(file.type) && !isAllowedImageType(file.type)) {
      return Response.json({ error: "File type not allowed" }, { status: 400 });
    }

    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      return Response.json({ error: "File too large" }, { status: 400 });
    }

    const documentId = generateUuid();
    const buffer = await file.arrayBuffer();

    await uploadDocument({
      documentId,
      body: Buffer.from(buffer),
      contentType: file.type,
    });

    return Response.json({ documentId, fileName: file.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to upload document:", error);
    return Response.json({ error: message }, { status: 500 });
  }
};
