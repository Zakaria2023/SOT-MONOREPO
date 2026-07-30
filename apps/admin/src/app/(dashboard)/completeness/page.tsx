import { getCompleteness } from "@/app/(dashboard)/completeness/action";
import { AsyncSection } from "@/components/shared/async-section";
import { CompletenessList } from "@/components/completeness/completeness-list";
import { CompletenessOverview } from "@/components/completeness/completeness-overview";
import { PROBLEM_KINDS } from "@/components/completeness/problem-kinds";
import { ListSearch } from "@/components/shared/list-search";
import type { CompletenessFilters } from "@/components/completeness/href";

type Props = {
  searchParams: Promise<CompletenessFilters>;
};

type ReportProps = {
  filters: CompletenessFilters;
};

// However many products fail, an author works through a screenful at a time — and
// a thousand cards would hang the browser rather than help. The cap is STATED
// below rather than applied quietly: a list that silently stops reads as a list
// that ended.
const RENDER_LIMIT = 100;

const isProblemKind = (
  value: string | undefined,
): value is keyof typeof PROBLEM_KINDS =>
  value !== undefined && value in PROBLEM_KINDS;

const Report = async ({ filters }: ReportProps) => {
  const entries = await getCompleteness();
  const search = filters.search?.trim().toLowerCase();

  // The overview keeps the WHOLE catalog; only the list narrows. Tiles that moved
  // with the filters would read as the catalog improving.
  const matching = entries
    .filter((entry) => !entry.complete)
    .filter((entry) => !filters.category || entry.categoryUuid === filters.category)
    .filter(
      (entry) =>
        !isProblemKind(filters.kind) ||
        entry.problems.some((problem) => problem.kind === filters.kind),
    )
    .filter((entry) => !search || entry.name.toLowerCase().includes(search))
    .sort((a, b) => {
      const blocking = (entry: typeof a) =>
        entry.problems.filter((problem) => PROBLEM_KINDS[problem.kind].blocking)
          .length;
      return (
        blocking(b) - blocking(a) ||
        b.problems.length - a.problems.length ||
        a.name.localeCompare(b.name)
      );
    });

  const shown = matching.slice(0, RENDER_LIMIT);

  return (
    <div className="flex flex-col gap-5">
      <CompletenessOverview entries={entries} filters={filters} />

      {matching.length > shown.length && (
        <p className="text-xs text-faint">
          Showing the {shown.length} worst of {matching.length} products with
          problems — narrow by category or problem kind to see the rest.
        </p>
      )}

      <CompletenessList
        entries={shown}
        filtered={Boolean(
          filters.category || isProblemKind(filters.kind) || search,
        )}
      />
    </div>
  );
};

const CompletenessPage = async ({ searchParams }: Props) => {
  const filters = await searchParams;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl text-ink">Spec completeness</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Products whose specification data the compatibility engine cannot fully
          read. A rule only fires on products that carry its attribute, so a
          missing or unreadable value does not fail a check — it skips it, and a
          skipped check looks exactly like a passed one.
        </p>
      </div>

      <ListSearch placeholder="Search products..." />

      <AsyncSection
        reloadKey={`${filters.search ?? ""}-${filters.category ?? ""}-${filters.kind ?? ""}`}
      >
        <Report filters={filters} />
      </AsyncSection>
    </div>
  );
};

export default CompletenessPage;
