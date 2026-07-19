// Dynamic Expo config. Instead of a separate mobile env file, the app reuses the
// monorepo's single source of env — the root `.env.local`. Expo only auto-loads
// env files from the app directory, so we read the root file here at config-eval
// time (in Node) and hand the values to the app through `extra`. They are read
// back at runtime via expo-constants in src/lib/env.ts.
const fs = require("fs");
const path = require("path");

const parseEnvFile = (filePath) => {
  const result = {};
  if (!fs.existsSync(filePath)) {
    return result;
  }
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
};

const rootEnv = parseEnvFile(path.resolve(__dirname, "../../.env.local"));

// API base URL resolution, most specific first:
//  1. a shell override (e.g. your LAN IP for a physical device during dev),
//  2. EXPO_PUBLIC_API_URL in the root .env.local — the mobile-specific URL
//     (the deployed API), so no local server is needed,
//  3. NEXT_PUBLIC_API_URL shared with the other apps,
//  4. localhost as a last resort.
const apiUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  rootEnv.EXPO_PUBLIC_API_URL ??
  rootEnv.NEXT_PUBLIC_API_URL ??
  "http://localhost:3002";

const clerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  rootEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

module.exports = {
  expo: {
    name: "SOT",
    slug: "sot-mobile",
    scheme: "sotmobile",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    backgroundColor: "#0b0b0f",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.sot.mobile",
    },
    android: {
      package: "com.sot.mobile",
    },
    web: {
      bundler: "metro",
      output: "static",
    },
    plugins: ["expo-router", "expo-secure-store"],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      apiUrl,
      clerkPublishableKey,
    },
  },
};
