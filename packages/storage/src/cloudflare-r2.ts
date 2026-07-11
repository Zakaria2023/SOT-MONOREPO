import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

/**
 * Reads a required environment variable, throwing at the point of use if it is
 * missing.
 */
const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

// Built on first use rather than at import time, so simply importing this
// module — as Next does when collecting page data during a build — doesn't
// require the R2 env vars to be present. Only an actual upload/download does.
let client: S3Client | null = null;

/**
 * The shared S3Client pointed at Cloudflare R2, created on first call and then
 * memoised. Credentials and endpoint are read from environment variables:
 *   R2_ENDPOINT          — the account-scoped R2 endpoint URL
 *   R2_ACCESS_KEY_ID     — R2 API token access key ID
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 */
export const getCloudflareR2 = (): S3Client => {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: requiredEnv("R2_ENDPOINT"),
      forcePathStyle: true,
      credentials: {
        accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return client;
};

/**
 * The R2 bucket name this app reads from and writes to, sourced from the
 * R2_BUCKET_NAME environment variable and read on use rather than at import.
 */
export const getR2BucketName = (): string => requiredEnv("R2_BUCKET_NAME");
