import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

/**
 * Reads a required environment variable, throwing at startup if it is missing
 * rather than silently failing at the point of use.
 */
const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

/**
 * Pre-configured S3Client pointed at Cloudflare R2.
 *
 * Credentials and endpoint are read from environment variables at module
 * initialisation time so the app fails fast if any are absent:
 *   R2_ENDPOINT        — the account-scoped R2 endpoint URL
 *   R2_ACCESS_KEY_ID   — R2 API token access key ID
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 */
export const cloudflareR2 = new S3Client({
  region: "auto",
  endpoint: requiredEnv("R2_ENDPOINT"),
  forcePathStyle: true,
  credentials: {
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
  },
});

/**
 * The R2 bucket name this app reads from and writes to.
 * Sourced from the R2_BUCKET_NAME environment variable.
 */
export const CLOUDFLARE_R2_BUCKET_NAME = requiredEnv("R2_BUCKET_NAME");
