import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  experimental: {
    externalDir: true,
  },
  transpilePackages: ["services", "storage", "auth", "validators"],
};

export default nextConfig;
