import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import {
  cloudflareR2,
  CLOUDFLARE_R2_BUCKET_NAME,
  createDocumentObjectKey,
} from "storage";

export const DELETE = async (
  _req: Request,
  context: { params: Promise<{ documentId: string }> },
) => {
  try {
    const { documentId } = await context.params;

    await cloudflareR2.send(
      new DeleteObjectCommand({
        Bucket: CLOUDFLARE_R2_BUCKET_NAME,
        Key: createDocumentObjectKey(documentId),
      }),
    );

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete document:", error);
    return Response.json({ error: "Failed to delete document" }, { status: 500 });
  }
};
