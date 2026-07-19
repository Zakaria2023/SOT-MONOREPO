// Base URL of the versioned REST API (apps/api). On a physical device this must
// be your machine's LAN IP (e.g. http://192.168.1.20:3002), since "localhost"
// resolves to the phone itself. Set it in apps/mobile/.env — see .env.example.
const fromEnv = process.env.EXPO_PUBLIC_API_URL;

export const API_URL = fromEnv && fromEnv.length > 0 ? fromEnv : "http://localhost:3002";

export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
