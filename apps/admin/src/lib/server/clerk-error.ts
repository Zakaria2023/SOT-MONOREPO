import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { fail } from "utils";

/**
 * `fail`, but reading Clerk's own message first when Clerk is what threw.
 *
 * A ClerkAPIResponseError's `message` is the generic one; `longMessage` is the
 * sentence worth showing — "That email address is taken. Please try another."
 * Falling straight through to `fail` would swallow it and show the caller's
 * fallback instead, which is exactly the failure `fail` exists to prevent.
 *
 * Lives here rather than in packages/utils because that package is imported by
 * browser code and has no business depending on Clerk. Separate from
 * lib/server/clerk.ts because that file is "use server", where every export
 * must be an async function and this one is not.
 */
export const failClerk = (
  error: unknown,
  fallback: string,
): { error: string } => {
  if (isClerkAPIResponseError(error)) {
    const [firstError] = error.errors;
    return {
      error: firstError?.longMessage ?? firstError?.message ?? fallback,
    };
  }

  return fail(error, fallback);
};
