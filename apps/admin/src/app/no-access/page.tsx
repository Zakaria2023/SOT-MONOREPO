import { SignOutButton } from "@clerk/nextjs";
import { ShieldAlert } from "lucide-react";

/**
 * Where a signed-in user without the admin role lands.
 *
 * A dedicated page rather than a redirect back to /sign-in. The session is valid,
 * so a sign-in screen either bounces them straight back here or reports "session
 * already exists" — both of which read as a broken login rather than as a
 * permission decision. This says what happened and offers the only useful action.
 *
 * Public in proxy.ts, or the gate that sends people here would gate this too.
 */
const NoAccessPage = () => (
  <main className="flex min-h-screen items-center justify-center bg-page px-6">
    <div className="flex max-w-md flex-col items-center gap-5 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-hairline text-faint">
        <ShieldAlert size={26} />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl text-ink">
          You don&apos;t have access to this dashboard
        </h1>
        <p className="text-sm text-muted">
          Your account is signed in, but it isn&apos;t a staff account. If you
          think it should be, ask an administrator to grant you access.
        </p>
      </div>

      <SignOutButton>
        <button
          type="button"
          className="rounded-control border border-hairline px-4 py-2.5 text-sm font-medium text-secondary transition-colors hover:bg-hover hover:text-ink"
        >
          Sign out
        </button>
      </SignOutButton>
    </div>
  </main>
);

export default NoAccessPage;
