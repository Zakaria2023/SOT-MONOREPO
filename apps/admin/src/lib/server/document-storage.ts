import "server-only";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cloudflareR2, CLOUDFLARE_R2_BUCKET_NAME } from "./cloudflare-r2";

/** Maximum permitted upload size (20 MB). */
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;

/** MIME types accepted for document uploads. */
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

type CreateDocumentUploadUrlParams = {
  documentId: string;
  contentType: string;
};

type CreateDocumentDownloadUrlParams = {
  documentId: string;
  fileName?: string;
};

/** Returns true when `contentType` is in the allowed document types list. */
export const isAllowedDocumentType = (contentType: string): boolean =>
  (ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(contentType);

/** Replaces any character that is not alphanumeric, `.`, `-`, or `_` with `_`. */
export const sanitizeFileName = (fileName: string): string =>
  fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");

/**
 * Derives the R2 object key from a document ID.
 *
 * Using a flat `documents/{documentId}` key means the download route can
 * reconstruct the key from the ID alone — no DB lookup required.
 */
export const createDocumentObjectKey = (documentId: string): string =>
  `documents/${documentId}`;

/**
 * Generates a pre-signed PUT URL for uploading a document directly to R2.
 *
 * The URL is valid for 5 minutes. The caller must send the file as the request
 * body with the matching `Content-Type` header.
 */
export const createDocumentUploadUrl = ({
  documentId,
  contentType,
}: CreateDocumentUploadUrlParams): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: CLOUDFLARE_R2_BUCKET_NAME,
    Key: createDocumentObjectKey(documentId),
    ContentType: contentType,
  });

  return getSignedUrl(cloudflareR2, command, { expiresIn: 60 * 5 });
};

/**
 * Generates a pre-signed GET URL for downloading a document from R2.
 *
 * The URL is valid for 1 minute. If `fileName` is provided the browser will
 * be instructed to save the file under that name; otherwise it falls back to
 * the stored object key.
 */
export const createDocumentDownloadUrl = ({
  documentId,
  fileName,
}: CreateDocumentDownloadUrlParams): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: CLOUDFLARE_R2_BUCKET_NAME,
    Key: createDocumentObjectKey(documentId),
    ...(fileName && {
      ResponseContentDisposition: `attachment; filename="${sanitizeFileName(fileName)}"`,
    }),
  });

  return getSignedUrl(cloudflareR2, command, { expiresIn: 60 });
};
