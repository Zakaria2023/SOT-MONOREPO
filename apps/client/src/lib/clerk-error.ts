/**
 * Extracts a human-readable message from whatever Clerk hands back. The new
 * signals API returns a `ClerkError` (which extends `Error`, so it has
 * `.message`); thrown/legacy errors expose an `errors` array. Falls back to a
 * generic message.
 */
export const toClerkErrorMessage = (
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string => {
  if (typeof error === "object" && error !== null) {
    if (
      "errors" in error &&
      Array.isArray((error as { errors: unknown }).errors)
    ) {
      const [first] = (error as { errors: { message?: string }[] }).errors;
      if (first?.message) {
        return first.message;
      }
    }

    if (
      "message" in error &&
      typeof (error as { message: unknown }).message === "string" &&
      (error as { message: string }).message.length > 0
    ) {
      return (error as { message: string }).message;
    }
  }
  return fallback;
};
