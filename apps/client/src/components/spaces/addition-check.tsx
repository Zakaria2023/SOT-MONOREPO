import { CircleCheck, CircleHelp, PackagePlus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { AdditionCheck } from "services";

// E10, the "add to system" half.
//
// THE WHOLE POINT IS THAT IT COUNTS WHAT IS ALREADY ON THE WALL. Four cameras
// judged on their own pass easily — four cameras need one switch and any switch
// will do. Judged against this site, those same four go onto a switch already
// carrying six, and the PoE budget is the answer. A design check that ignores the
// building is a design check for a different building.
//
// So the existing load is listed, not just the verdict. "Your switch is over
// budget" sends somebody hunting; "your switch is already carrying six cameras and
// these four take it past its budget" is the same sentence with the reason in it.

type AdditionCheckPanelProps = {
  spaceName: string;
  check: (AdditionCheck & { adding: { name: string; quantity: number }[] }) | null;
};

export const AdditionCheckPanel = ({
  spaceName,
  check,
}: AdditionCheckPanelProps) => {
  // No basket, no question. An "it all works" verdict over nothing is the emptiest
  // kind of reassurance, so there is nothing here until they are actually shopping.
  if (!check) {
    return null;
  }

  const { gate, existing, adding } = check;
  const clean =
    gate.blockers.length === 0 &&
    gate.warnings.length === 0 &&
    gate.unknowns.length === 0;

  return (
    <section className="mt-8">
      <h2 className="font-heading flex items-center gap-2 text-lg text-ink">
        <PackagePlus size={17} className="text-primary" />
        Will your basket work here?
      </h2>
      <p className="font-grotesk mt-0.5 text-sm text-muted">
        Checked against the {existing.length}{" "}
        {existing.length === 1 ? "thing" : "things"} already installed at{" "}
        {spaceName} — not against an empty room.
      </p>

      <div className="mt-3 flex flex-col gap-3 rounded-[18px] border border-search-border bg-surface p-5">
        <div className="font-grotesk flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <span className="text-muted">
            Adding:{" "}
            <span className="text-ink">
              {adding
                .map((line) => `${line.quantity} × ${line.name}`)
                .join(", ")}
            </span>
          </span>
        </div>

        {clean ? (
          <p className="font-grotesk flex items-start gap-2 text-sm text-emerald-800">
            <CircleCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />
            Nothing in your basket conflicts with what is already fitted here.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {gate.blockers.map((finding) => (
              <p
                key={finding.id}
                className="font-grotesk flex items-start gap-2 rounded-control border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium">{finding.title}</span>
                  {" — "}
                  {finding.message}
                </span>
              </p>
            ))}
            {gate.warnings.map((finding) => (
              <p
                key={finding.id}
                className="font-grotesk flex items-start gap-2 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              >
                <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium">{finding.title}</span>
                  {" — "}
                  {finding.message}
                </span>
              </p>
            ))}
            {/* Surfaced, never swallowed. A check that could not run is a different
                fact from a check that passed, and this is the site where the
                missing half is most likely to be a firmware version nobody has
                verified. */}
            {gate.unknowns.map((finding) => (
              <p
                key={finding.id}
                className="font-grotesk flex items-start gap-2 rounded-control border border-search-border bg-hover px-3 py-2 text-sm text-muted"
              >
                <CircleHelp size={14} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium text-ink">{finding.title}</span>
                  {" — "}
                  {finding.message}
                </span>
              </p>
            ))}
          </div>
        )}

        {existing.length > 0 && (
          <details className="font-grotesk text-xs text-muted">
            <summary className="cursor-pointer hover:text-ink">
              What was counted as already installed
            </summary>
            <ul className="mt-2 flex flex-col gap-0.5 pl-4">
              {existing.map((row) => (
                <li key={row.productUuid}>
                  {row.quantity} × {row.name}
                </li>
              ))}
            </ul>
          </details>
        )}

        <Link
          href="/cart"
          className="font-grotesk w-fit text-xs font-medium text-primary hover:underline"
        >
          Back to your basket
        </Link>
      </div>
    </section>
  );
};
