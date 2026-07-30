import type { ProductCompleteness } from "@/app/(dashboard)/completeness/action";
import { PROBLEM_KINDS } from "@/components/completeness/problem-kinds";
import { CircleCheck, Pencil } from "lucide-react";
import Link from "next/link";

type CompletenessListProps = {
  entries: ProductCompleteness[];
  // True when the empty state is empty because a filter excluded everything,
  // rather than because there is nothing wrong. Saying "all clear" to someone who
  // has narrowed to one category would be a lie about the rest of the catalog.
  filtered: boolean;
};

export const CompletenessList = ({
  entries,
  filtered,
}: CompletenessListProps) => {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-hairline bg-surface p-10 text-center shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-tint text-success">
          <CircleCheck size={20} />
        </span>
        <p className="text-sm font-semibold text-ink">
          {filtered
            ? "Nothing matches these filters."
            : "Every product's spec data is readable."}
        </p>
        <p className="max-w-md text-xs leading-relaxed text-faint">
          {filtered
            ? "Clear a filter above to see the rest of the catalog."
            : "Every attribute the engine reads has a value it can rank, match and render — so no rule is silently skipping a product."}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry) => (
        <li
          key={entry.productUuid}
          className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-5 shadow-[0_1px_2px_rgba(27,35,51,0.04)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <Link
                href={`/products/${entry.productUuid}`}
                className="text-sm font-semibold text-ink hover:text-primary"
              >
                {entry.name}
              </Link>
              <span className="text-xs text-faint">
                {entry.categoryName ?? "Uncategorised"} ·{" "}
                {entry.problems.length} problem
                {entry.problems.length === 1 ? "" : "s"}
              </span>
            </div>

            <Link
              href={`/products/${entry.productUuid}/edit`}
              className="flex items-center gap-1.5 rounded-control border border-hairline px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-hover"
            >
              <Pencil size={13} />
              Fix
            </Link>
          </div>

          <ul className="flex flex-col divide-y divide-hairline">
            {entry.problems.map((problem, index) => {
              const meta = PROBLEM_KINDS[problem.kind];
              return (
                <li
                  key={`${problem.specificationUuid}-${problem.kind}-${index}`}
                  className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {problem.label}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}
                    >
                      {meta.label}
                    </span>
                    {problem.reason === "revealed" && (
                      <span className="rounded-full bg-hover px-2 py-0.5 text-[11px] font-semibold text-faint">
                        Revealed by another answer
                      </span>
                    )}
                  </div>
                  {problem.detail && (
                    <p className="text-xs leading-relaxed text-muted">
                      {problem.detail}
                    </p>
                  )}
                  <p className="text-xs leading-relaxed text-faint">
                    {meta.fix}
                  </p>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
};
