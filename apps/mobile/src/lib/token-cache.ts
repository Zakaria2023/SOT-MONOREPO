import * as SecureStore from "expo-secure-store";

// Persists the Clerk session token in the device keychain / keystore so the
// user stays signed in across app launches. Shape matches ClerkProvider's
// `tokenCache` prop (getToken / saveToken / clearToken).
export const tokenCache = {
  getToken: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  saveToken: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // A failed secure-store write must not crash the app.
    }
  },
  clearToken: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore delete failures.
    }
  },
};
