import "server-only";

import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getCloudflareR2, getR2BucketName } from "./cloudflare-r2";

/** Maximum permitted upload size (20 MB). */
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;

/** Maximum permitted image upload size (5 MB). */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** MIME types accepted for document uploads. */
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/** MIME types accepted for image uploads. */
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
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

/** Returns true when `contentType` is in the allowed image types list. */
export const isAllowedImageType = (contentType: string): boolean =>
  (ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType);

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

type UploadDocumentParams = {
  documentId: string;
  body: Buffer;
  contentType: string;
};

/** Uploads a document to R2 under its derived key. */
export const uploadDocument = async ({
  documentId,
  body,
  contentType,
}: UploadDocumentParams): Promise<void> => {
  await getCloudflareR2().send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: createDocumentObjectKey(documentId),
      Body: body,
      ContentType: contentType,
    }),
  );
};

/** Deletes a document from R2 by its id. */
export const deleteDocument = async (documentId: string): Promise<void> => {
  await getCloudflareR2().send(
    new DeleteObjectCommand({
      Bucket: getR2BucketName(),
      Key: createDocumentObjectKey(documentId),
    }),
  );
};

export type UploadedDocument = {
  documentId: string;
  fileName: string;
};

/**
 * Validates a `File` and uploads it to R2, returning its id and name. Shared by
 * the upload Server Action and (for the admin) the upload route handler. Throws
 * "File type not allowed" / "File too large" for a bad file.
 */
export const uploadDocumentFile = async (
  file: File,
): Promise<UploadedDocument> => {
  if (!isAllowedDocumentType(file.type) && !isAllowedImageType(file.type)) {
    throw new Error("File type not allowed");
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error("File too large");
  }

  const documentId = randomUUID();
  await uploadDocument({
    documentId,
    body: Buffer.from(await file.arrayBuffer()),
    contentType: file.type,
  });

  return { documentId, fileName: file.name };
};

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
    Bucket: getR2BucketName(),
    Key: createDocumentObjectKey(documentId),
    ContentType: contentType,
  });

  return getSignedUrl(getCloudflareR2(), command, { expiresIn: 60 * 5 });
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
    Bucket: getR2BucketName(),
    Key: createDocumentObjectKey(documentId),
    ...(fileName && {
      ResponseContentDisposition: `attachment; filename="${sanitizeFileName(fileName)}"`,
    }),
  });

  return getSignedUrl(getCloudflareR2(), command, { expiresIn: 60 });
};
