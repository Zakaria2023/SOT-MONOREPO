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
  },
  transpilePackages: ["rate-limit", "services", "storage", "auth"],
};

export default nextConfig;
