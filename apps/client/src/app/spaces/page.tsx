import { getCurrentUser } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight } from "lucide-react";
import { listSpaces } from "services";

// 6.1. The customer's own sites.
//
// A list, not a dashboard. The only question this page answers is "which
// building", and everything else belongs on the one they pick.
//
// Nothing here creates a Space. They are created by the handover that fills them,
// because a site register with no equipment in it is an empty answer that looks
// like a real one — and a customer who made one by hand before their install would
// be told their fire system contains nothing.

export const metadata: Metadata = pageMetadata({
  title: "Your sites",
  description: "The equipment installed at each of your sites.",
  path: "/spaces",
  noIndex: true,
});

const SpacesPage = async () => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const spaces = await listSpaces(user.uuid);

  return (
    <main className="mx-auto px-6 py-12 lg:px-12 xl:px-20">
      <h1 className="font-heading text-2xl text-ink">Your sites</h1>
      <p className="font-grotesk mt-1 text-sm text-muted">
        What is installed where, and when it was put in.
      </p>

      {spaces.length === 0 ? (
        <p className="font-grotesk mt-6 rounded-[18px] border border-dashed border-search-border px-6 py-12 text-center text-sm text-muted">
          Nothing yet. A site appears here once one of your installations has been
          verified — it is built from the record your installer hands over, so
          there is nothing for you to fill in.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {spaces.map((space) => (
            <Link
              key={space.uuid}
              href={`/spaces/${space.uuid}`}
              className="flex items-center justify-between gap-4 rounded-[18px] border border-search-border p-5 transition-colors hover:bg-hover"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Building2 size={18} className="shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{space.name}</p>
                  <p className="font-grotesk text-xs text-muted">
                    {/* Units rather than rows. A batch of twenty detectors is
                        twenty things in the building, and a row count says one. */}
                    {space.summary.units}{" "}
                    {space.summary.units === 1 ? "item" : "items"}
                    {space.summary.retired > 0 &&
                      ` · ${space.summary.retired} replaced`}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-faint" />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
};

export default SpacesPage;
