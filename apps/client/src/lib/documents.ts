const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Builds the URL of the shared document-download endpoint served by apps/api.
 * The endpoint 302-redirects to a short-lived pre-signed R2 URL, so it can be
 * used directly as an <Image> / <img> src.
 */
export const documentDownloadUrl = (documentId: string): string =>
  `${apiBaseUrl}/api/v1/documents/${documentId}/download`;
