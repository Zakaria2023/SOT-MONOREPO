"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

// Where OAuth providers return to. Clerk finishes the sign-in/sign-up here and
// then redirects home. Kept minimal on purpose — no UI, it resolves instantly.
const SsoCallbackPage = () => (
  <AuthenticateWithRedirectCallback
    signInFallbackRedirectUrl="/"
    signUpFallbackRedirectUrl="/complete-profile"
  />
);

export default SsoCallbackPage;
