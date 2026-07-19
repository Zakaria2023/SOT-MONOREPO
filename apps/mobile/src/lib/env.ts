import Constants from "expo-constants";

// Values are injected at config-eval time by app.config.js, which reads them
// from the monorepo root .env.local (there is no separate mobile env file).
type MobileExtra = {
  apiUrl?: string;
  clerkPublishableKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as MobileExtra;

// Base URL of the versioned REST API (apps/api). On a physical device this must
// be your machine's LAN IP (e.g. http://192.168.1.20:3002), since "localhost"
// resolves to the phone itself — override via EXPO_PUBLIC_API_URL when running.
export const API_URL =
  extra.apiUrl && extra.apiUrl.length > 0
    ? extra.apiUrl
    : "http://localhost:3002";

export const CLERK_PUBLISHABLE_KEY = extra.clerkPublishableKey;
