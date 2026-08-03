/**
 * Same-origin document-download endpoint. It 302-redirects to a short-lived
 * pre-signed R2 URL, so it can be used directly as an <Image> / <img> src —
 * no separate server needs to be running.
 */
export const documentDownloadUrl = (documentId: string): string =>
  `/api/documents/${documentId}/download`;

/**
 * Source for <Image>, which cannot use the download URL above: next/image
 * refuses to follow that route's 302 and rejects it outright. This one streams
 * the bytes, so the optimizer can resize it and emit WebP/AVIF.
 *
 * Use it for anything rendered as an image. Keep documentDownloadUrl for actual
 * downloads, where handing the client straight to R2 is the cheaper path.
 */
export const documentImageUrl = (documentId: string): string =>
  `/api/documents/${documentId}/image`;
