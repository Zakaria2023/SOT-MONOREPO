import { getSpacesAction } from "@/app/(dashboard)/spaces/action";
import { Building2, CircleAlert } from "lucide-react";
import Link from "next/link";

// The support view of every customer site.
//
// Sorted newest-first from the service, but the count that earns its place on this
// list is `unverifiedFirmware`: those are the versions somebody typed and nobody
// checked, and until one is checked a rule reading it can only warn. So the work
// this screen exists to hand out is visible from the list rather than one click in.

export const SpacesBoard = async () => {
  const spaces = await getSpacesAction();

  if (spaces.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-4 py-10 text-center text-sm text-faint">
        No sites yet. One is created for a customer when their installation is
        verified.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {spaces.map((space) => (
        <Link
          key={space.uuid}
          href={`/spaces/${space.uuid}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3 transition-colors hover:border-primary"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Building2 size={16} className="shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{space.name}</p>
              <p className="text-[11px] text-muted">
                {space.ownerName ?? "Unknown owner"} · {space.units}{" "}
                {space.units === 1 ? "item" : "items"}
              </p>
            </div>
          </div>

          {space.unverifiedFirmware > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900">
              <CircleAlert size={11} />
              {space.unverifiedFirmware} firmware to check
            </span>
          )}
        </Link>
      ))}
    </div>
  );
};
