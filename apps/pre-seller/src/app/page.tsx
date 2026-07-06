import { requirePreSeller } from "@/lib/server/auth";
import { SignOutButton } from "@clerk/nextjs";

const DashboardPage = async () => {
  const user = await requirePreSeller();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-bold tracking-widest text-primary uppercase">
            Pre-seller
          </p>
          <h1 className="font-heading mt-2 text-4xl font-extrabold text-ink">
            Welcome, {user.firstName ?? "there"}
          </h1>
          <p className="mt-2 text-neutral-500">
            Your dashboard is ready. Tools will appear here soon.
          </p>
        </div>

        <SignOutButton>
          <button
            type="button"
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Sign out
          </button>
        </SignOutButton>
      </div>
    </main>
  );
};

export default DashboardPage;
