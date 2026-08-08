import { getValueSweepAction } from "@/app/(dashboard)/library/action";
import { AlertTriangle, Copy, EyeOff } from "lucide-react";

// ---------------------------------------------------------------------------
// WHERE THE PRODUCTS AND THE LIBRARY HAVE DRIFTED APART.
//
// Ordered by how badly each one fails. A value no option offers is first
// because it is the only one that is silently dangerous: every set comparator
// misses it, so a rule that reads correctly passes the very product it was
// written to catch.
// ---------------------------------------------------------------------------

export const ValueSweepPanel = async () => {
  const sweeps = await getValueSweepAction();

  if (sweeps.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-4 py-6 text-center text-xs text-faint">
        Every stored value is one the library offers, and no two spellings of the
        same thing are in use.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sweeps.map((sweep) => (
        <div
          key={sweep.specUuid}
          className="flex flex-col gap-2 rounded-card border border-hairline bg-base px-3 py-2.5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-ink">{sweep.label}</span>
            <span className="shrink-0 text-[11px] text-faint">
              {sweep.productsAnswering} value
              {sweep.productsAnswering === 1 ? "" : "s"} stored
            </span>
          </div>

          {sweep.offVocabulary.length > 0 && (
            <div className="flex flex-col gap-0.5 rounded-control border border-red-500/30 bg-red-500/10 px-2.5 py-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-red-400">
                <AlertTriangle size={12} />
                Not in the option list — every set comparator misses these
              </span>
              {sweep.offVocabulary.map((use) => (
                <p key={use.value} className="text-[11px] text-red-400">
                  <span className="font-mono">{use.value}</span> — on{" "}
                  {use.products} product{use.products === 1 ? "" : "s"}
                </p>
              ))}
            </div>
          )}

          {sweep.nearDuplicates.map((duplicate) => (
            <div
              key={duplicate.normalised}
              className="flex flex-col gap-0.5 rounded-control border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-500">
                <Copy size={12} />
                Two spellings of one value — nothing will ever match them together
              </span>
              <p className="text-[11px] text-amber-500">
                {duplicate.values
                  .map((use) => `"${use.value}" ×${use.products}`)
                  .join("  ·  ")}
              </p>
            </div>
          ))}

          {sweep.unusedOptions.length > 0 && (
            <p className="flex items-start gap-1.5 text-[11px] text-secondary">
              <EyeOff size={12} className="mt-0.5 shrink-0" />
              <span>
                Offered, never picked:{" "}
                {sweep.unusedOptions.map((option) => option.label).join(", ")}
              </span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
};
