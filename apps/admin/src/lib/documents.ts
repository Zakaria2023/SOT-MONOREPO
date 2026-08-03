/**
 * Same-origin document-download endpoint. It 302-redirects to a short-lived
 * pre-signed R2 URL, which is the cheaper path for an actual download — the
 * bytes go from R2 to the browser without passing through us.
 *
 * Not usable as an <Image> src: next/image will not follow that redirect. Use
 * documentImageUrl below for anything rendered as an image.
 */
export const documentDownloadUrl = (documentId: string): string =>
  `/api/documents/${documentId}/download`;

/**
 * Streams a document's bytes, so next/image can resize it and serve AVIF/WebP.
 * Admin lists render the same multi-megabyte supplier PNGs as the storefront,
 * into 40px table cells.
 */
export const documentImageUrl = (documentId: string): string =>
  `/api/documents/${documentId}/image`;
