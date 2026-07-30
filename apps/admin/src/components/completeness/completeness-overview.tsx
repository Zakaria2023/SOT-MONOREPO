import type {
  CompletenessProblem,
  ProductCompleteness,
} from "@/app/(dashboard)/completeness/action";
import {
  PROBLEM_KIND_ORDER,
  PROBLEM_KINDS,
} from "@/components/completeness/problem-kinds";
import {
  completenessHref,
  type CompletenessFilters,
} from "@/components/completeness/href";
import { CircleCheck, CircleSlash, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type CompletenessOverviewProps = {
  // Every product, unfiltered — the tiles and the counts describe the whole
  // catalog. A tile that moved when a filter changed would read as the catalog
  // improving.
  entries: ProductCompleteness[];
  filters: CompletenessFilters;
};

type TileProps = {
  icon: ReactNode;
  value: number;
  label: string;
  hint: string;
  toneClass: string;
};

type CategoryRow = {
  categoryUuid: string;
  categoryName: string | null;
  total: number;
  affected: number;
};

const Tile = ({ icon, value, label, hint, toneClass }: TileProps) => (
  <div className="flex flex-col gap-2 rounded-card border border-hairline bg-surface p-5 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
    <div className="flex items-center gap-2">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-control ${toneClass}`}
      >
        {icon}
      </span>
      <span className="font-heading text-2xl text-ink">{value}</span>
    </div>
    <span className="text-sm font-semibold text-ink">{label}</span>
    <span className="text-xs leading-relaxed text-faint">{hint}</span>
  </div>
);

const isBlocking = (problem: CompletenessProblem): boolean =>
  PROBLEM_KINDS[problem.kind].blocking;

export const CompletenessOverview = ({
  entries,
  filters,
}: CompletenessOverviewProps) => {
  const unreadable = entries.filter((entry) =>
    entry.problems.some(isBlocking),
  ).length;
  const decisions = entries.filter(
    (entry) =>
      !entry.problems.some(isBlocking) &&
      entry.problems.some((problem) => !isBlocking(problem)),
  ).length;

  // Products affected per kind, not problems — an author picks a kind to work
  // through a list of products, so the number beside it has to be the length of
  // that list.
  const perKind = new Map<CompletenessProblem["kind"], number>();
  for (const entry of entries) {
    for (const kind of new Set(entry.problems.map((problem) => problem.kind))) {
      perKind.set(kind, (perKind.get(kind) ?? 0) + 1);
    }
  }

  const categories = new Map<string, CategoryRow>();
  for (const entry of entries) {
    const row = categories.get(entry.categoryUuid) ?? {
      categoryUuid: entry.categoryUuid,
      categoryName: entry.categoryName,
      total: 0,
      affected: 0,
    };
    row.total += 1;
    if (!entry.complete) {
      row.affected += 1;
    }
    categories.set(entry.categoryUuid, row);
  }
  const categoryRows = [...categories.values()]
    .filter((row) => row.affected > 0)
    .sort((a, b) => b.affected - a.affected);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile
          icon={<CircleCheck size={16} />}
          value={entries.filter((entry) => entry.complete).length}
          label={`Ready, of ${entries.length} products`}
          hint="Every attribute the engine reads on this product's category has a readable value."
          toneClass="bg-success-tint text-success"
        />
        <Tile
          icon={<CircleSlash size={16} />}
          value={unreadable}
          label="The engine cannot read"
          hint="A rule only fires on products carrying its attribute, so these are not failing checks — they are skipping them."
          toneClass="bg-danger-tint text-danger"
        />
        <Tile
          icon={<TriangleAlert size={16} />}
          value={decisions}
          label="Waiting on a decision"
          hint="The values are real and readable; this category just does not offer or carry them. Widen the assignment, or change the product."
          toneClass="bg-warning-tint text-warning"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={completenessHref(filters, { kind: "" })}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            filters.kind
              ? "border-hairline text-secondary hover:bg-hover"
              : "border-primary bg-primary text-white"
          }`}
        >
          All problems
        </Link>
        {PROBLEM_KIND_ORDER.map((kind) => {
          const count = perKind.get(kind) ?? 0;
          if (count === 0) {
            return null;
          }
          const active = filters.kind === kind;
          return (
            <Link
              key={kind}
              href={completenessHref(filters, { kind: active ? "" : kind })}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                active
                  ? "border-primary bg-primary text-white"
                  : "border-hairline text-secondary hover:bg-hover"
              }`}
            >
              {PROBLEM_KINDS[kind].label} · {count}
            </Link>
          );
        })}
      </div>

      {categoryRows.length > 0 && (
        <div className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-5 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-lg text-ink">By category</h2>
            {filters.category && (
              <Link
                href={completenessHref(filters, { category: "" })}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Clear category
              </Link>
            )}
          </div>
          <p className="text-xs text-faint">
            Whoever owns the category owns the backlog — an attribute is required
            because that category assigns it as a rule input.
          </p>
          <ul className="flex flex-col divide-y divide-hairline">
            {categoryRows.map((row) => {
              const active = filters.category === row.categoryUuid;
              return (
                <li key={row.categoryUuid}>
                  <Link
                    href={completenessHref(filters, {
                      category: active ? "" : row.categoryUuid,
                    })}
                    className={`flex items-center justify-between gap-4 rounded-control px-2 py-2.5 text-sm hover:bg-hover ${
                      active ? "bg-primary-tint/40" : ""
                    }`}
                  >
                    <span className="text-ink">
                      {row.categoryName ?? "Uncategorised"}
                    </span>
                    <span className="text-muted">
                      <span className="font-semibold text-ink">
                        {row.affected}
                      </span>{" "}
                      of {row.total}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
