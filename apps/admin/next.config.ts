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
  experimental: {
    externalDir: true,
    // Requests pass through proxy.ts (Clerk), where Next buffers the body with a
    // 10MB default cap; raise it above the 20MB document upload limit so large
    // uploads aren't truncated before reaching /api/documents/upload.
    proxyClientMaxBodySize: "25mb",
  },
  transpilePackages: ["rate-limit", "storage", "ui"],
  images: {
    // No remotePatterns any more. The R2 wildcard that used to sit here could
    // never have worked — <Image> pointed at /api/documents/{id}/download, and
    // next/image refuses to follow that route's 302 regardless of which hosts
    // are allowed — while leaving our optimizer willing to fetch and re-serve
    // any bucket on that domain. Images now go through
    // /api/documents/{id}/image, which is same-origin.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
