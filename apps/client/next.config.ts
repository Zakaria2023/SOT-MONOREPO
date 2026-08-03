import fs from "fs";
import type { NextConfig } from "next";
import path from "path";

// Load the single monorepo-root .env.local into process.env, without
// overriding any var the platform already set — so on Vercel (where this file
// doesn't exist) the project's dashboard env vars are used instead.
const rootEnv = path.join(__dirname, "../../.env.local");
if (fs.existsSync(rootEnv)) {
  for (const line of fs.readFileSync(rootEnv, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  images: {
    // Document ids are immutable — uploadDocumentFile mints a fresh randomUUID
    // and the key is `documents/{id}`, so a body is never rewritten under an
    // existing id. The optimizer's output can therefore be held for a month
    // instead of Next's short default, which would otherwise re-fetch and
    // re-encode the same photo repeatedly.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // AVIF first, WebP as the fallback. Supplier photos are large PNGs where the
    // saving is the difference between a 1.6MB download and single-digit KB.
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    externalDir: true,
    // Requests pass through proxy.ts (Clerk), where Next buffers the body with a
    // 10MB default cap; raise it above the 20MB document upload limit so large
    // uploads aren't truncated before reaching /api/documents/upload.
    proxyClientMaxBodySize: "25mb",
  },
  transpilePackages: ["services", "storage", "auth", "validators"],
};

export default nextConfig;
