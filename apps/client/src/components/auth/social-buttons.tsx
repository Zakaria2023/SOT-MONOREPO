"use client";

import { toClerkErrorMessage } from "@/lib/clerk-error";
import { useSignIn } from "@clerk/nextjs";
import { useState } from "react";

type OAuthProviderStrategy = "oauth_google" | "oauth_apple" | "oauth_facebook";

type SocialProvider = {
  strategy: OAuthProviderStrategy;
  label: string;
};

const PROVIDERS: SocialProvider[] = [
  { strategy: "oauth_google", label: "Google" },
  { strategy: "oauth_apple", label: "Apple" },
  { strategy: "oauth_facebook", label: "Facebook" },
];

// OAuth is a redirect flow, so it runs off Clerk's signIn resource and lands on
// /sso-callback to finish. The same buttons work for sign-in and sign-up —
// Clerk transfers a new user into a sign-up automatically at the callback.
export const SocialButtons = () => {
  const { signIn } = useSignIn();
  const [pending, setPending] = useState<OAuthProviderStrategy | null>(null);
  const [error, setError] = useState<string>();

  const start = async (strategy: OAuthProviderStrategy) => {
    setPending(strategy);
    setError(undefined);

    try {
      const { error: ssoError } = await signIn.sso({
        strategy,
        // Funnel through the self-gating profile page: it forwards users whose
        // profile is already complete and shows the form to those (e.g. new
        // social sign-ups) who still need to add a location.
        redirectUrl: "/complete-profile",
        redirectCallbackUrl: `${window.location.origin}/sso-callback`,
      });

      if (ssoError) {
        setError(toClerkErrorMessage(ssoError));
        setPending(null);
      }
      // On success the browser navigates to the provider — nothing else runs.
    } catch (caught) {
      setError(toClerkErrorMessage(caught));
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-hairline" />
        <span className="font-grotesk text-xs text-faint">
          or continue with
        </span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.strategy}
            type="button"
            disabled={pending !== null}
            onClick={() => start(provider.strategy)}
            className="font-grotesk rounded-xl border border-search-border bg-surface py-2.5 text-sm font-semibold text-ink transition-colors hover:border-primary disabled:pointer-events-none disabled:opacity-60"
          >
            {provider.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="font-grotesk text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};
