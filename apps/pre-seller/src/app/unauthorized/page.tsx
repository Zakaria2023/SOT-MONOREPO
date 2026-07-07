import { SignOutButton } from "@clerk/nextjs";

const UnauthorizedPage = () => (
  <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
    <h1 className="font-heading text-3xl text-ink">Access denied</h1>
    <p className="max-w-md text-neutral-500">
      Your account doesn&apos;t have pre-seller access. If you think this is a
      mistake, contact an administrator.
    </p>
    <SignOutButton>
      <button
        type="button"
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
      >
        Sign out
      </button>
    </SignOutButton>
  </main>
);

export default UnauthorizedPage;
