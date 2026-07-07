import { requirePreSeller } from "@/lib/server/auth";
import { SignOutButton } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const DashboardPage = async () => {
  const user = await requirePreSeller();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-bold tracking-widest text-primary uppercase">
            Pre-seller
          </p>
          <h1 className="font-heading mt-2 text-4xl text-ink">
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

      <Link
        href="/boqs"
        className="mt-10 flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 p-6 transition-colors hover:border-primary/40"
      >
        <div>
          <h2 className="font-heading text-xl font-semibold text-ink">
            Assigned BOQs
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Draft BOQs an admin has assigned to you to edit and submit.
          </p>
        </div>
        <ArrowRight size={20} className="text-primary" />
      </Link>
    </main>
  );
};

export default DashboardPage;
