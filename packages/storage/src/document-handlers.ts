import "server-only";

import {
  createDocumentDownloadUrl,
  deleteDocument,
  uploadDocumentFile,
} from "./document-storage";

type DocumentRouteContext = {
  params: Promise<{ documentId: string }>;
};

// Shared Route Handler bodies for the document download/delete endpoints. Each
// app's route.ts imports and calls these so the logic lives in one place.
// (Uploads are a mutation and go through a Server Action, not a route.)

const VALIDATION_MESSAGES = new Set(["File type not allowed", "File too large"]);

export const handleDocumentUpload = async (req: Request): Promise<Response> => {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    return Response.json(await uploadDocumentFile(file));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to upload document:", error);
    return Response.json(
      { error: message },
      { status: VALIDATION_MESSAGES.has(message) ? 400 : 500 },
    );
  }
};

export const handleDocumentDownload = async (
  req: Request,
  context: DocumentRouteContext,
): Promise<Response> => {
  try {
    const { documentId } = await context.params;
    const fileName = new URL(req.url).searchParams.get("fileName") ?? undefined;

    const downloadUrl = await createDocumentDownloadUrl({ documentId, fileName });

    return Response.redirect(downloadUrl, 302);
  } catch (error) {
    console.error("Failed to create document download URL:", error);
    return Response.json(
      { error: "Failed to download document" },
      { status: 500 },
    );
  }
};

export const handleDocumentDelete = async (
  _req: Request,
  context: DocumentRouteContext,
): Promise<Response> => {
  try {
    const { documentId } = await context.params;

    await deleteDocument(documentId);

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete document:", error);
    return Response.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  }
};
