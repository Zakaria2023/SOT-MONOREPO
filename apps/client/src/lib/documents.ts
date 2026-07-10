/**
 * Same-origin document-download endpoint. It 302-redirects to a short-lived
 * pre-signed R2 URL, so it can be used directly as an <Image> / <img> src —
 * no separate server needs to be running.
 */
export const documentDownloadUrl = (documentId: string): string =>
  `/api/documents/${documentId}/download`;
