import { PutObjectCommand } from "@aws-sdk/client-s3";
import { generateUuid } from "utils";
import {
  cloudflareR2,
  CLOUDFLARE_R2_BUCKET_NAME,
  createDocumentObjectKey,
  isAllowedDocumentType,
  isAllowedImageType,
  MAX_DOCUMENT_SIZE_BYTES,
} from "storage";

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

    await cloudflareR2.send(
      new PutObjectCommand({
        Bucket: CLOUDFLARE_R2_BUCKET_NAME,
        Key: createDocumentObjectKey(documentId),
        Body: Buffer.from(buffer),
        ContentType: file.type,
      }),
    );

    return Response.json({ documentId, fileName: file.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to upload document:", error);
    return Response.json({ error: message }, { status: 500 });
  }
};
