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

/**
 * Streams a document's bytes instead of redirecting to R2.
 *
 * This exists because next/image cannot consume the download route. Given a 302
 * it fails with `"url" parameter is valid but internal response is invalid` — it
 * does not follow redirects for same-origin sources. That is why every <Image>
 * in the storefront had to carry `unoptimized`, which in turn meant no srcset,
 * no WebP/AVIF, and a full-resolution photo rendered into a 200px thumbnail.
 *
 * The redirect is still the right answer for actual downloads (a datasheet PDF
 * should come off R2, not through us), so that route is untouched. This one is
 * for the optimizer, which fetches a given size once and then serves its own
 * cached copy — so these bytes pass through the app rarely, not per page view.
 *
 * `immutable` is safe rather than optimistic: uploadDocumentFile mints a fresh
 * randomUUID per upload and the object key is `documents/{documentId}`, so an id
 * addresses one body forever. Replacing a product photo creates a new document
 * with a new id; it never rewrites this one.
 */
export const handleDocumentImage = async (
  _req: Request,
  context: DocumentRouteContext,
): Promise<Response> => {
  try {
    const { documentId } = await context.params;
    const upstream = await fetch(await createDocumentDownloadUrl({ documentId }));

    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    const contentType = upstream.headers.get("content-type");
    // Anything that is not an image would sail past the optimizer and be served
    // from our origin under a year-long immutable cache.
    if (!contentType?.startsWith("image/")) {
      return Response.json({ error: "Not an image" }, { status: 415 });
    }

    const contentLength = upstream.headers.get("content-length");

    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        ...(contentLength && { "Content-Length": contentLength }),
      },
    });
  } catch (error) {
    console.error("Failed to stream document image:", error);
    return Response.json({ error: "Failed to load image" }, { status: 500 });
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
