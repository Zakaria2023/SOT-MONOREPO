import { getActivity } from "@/app/(dashboard)/activity/action";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { ActivityFilters } from "@/components/activity/activity-filters";
import { AsyncSection } from "@/components/shared/async-section";
import { ListSearch } from "@/components/shared/list-search";
import { catalogAuditActions, catalogAuditTargets } from "@/db/enum";
import type { CatalogAuditAction, CatalogAuditTarget } from "@/db/enum";

type Filters = {
  search?: string;
  target?: string;
  action?: string;
  // One row's whole history. Named `item` in the URL rather than `target` because
  // `target` already means the KIND of thing — two filters called the same would
  // be unreadable in a link.
  item?: string;
};

type Props = {
  searchParams: Promise<Filters>;
};

type TrailProps = {
  filters: Filters;
};

// The trail is append-only and grows forever, so a read has to be bounded. This
// is a ceiling on ONE narrowed query — the filters are applied in SQL, so
// narrowing reaches further back rather than sifting the same last page.
const FEED_LIMIT = 200;

const isTarget = (value: string | undefined): value is CatalogAuditTarget =>
  value !== undefined &&
  (catalogAuditTargets as readonly string[]).includes(value);

const isAction = (value: string | undefined): value is CatalogAuditAction =>
  value !== undefined &&
  (catalogAuditActions as readonly string[]).includes(value);

const Trail = async ({ filters }: TrailProps) => {
  const entries = await getActivity({
    target: isTarget(filters.target) ? filters.target : undefined,
    action: isAction(filters.action) ? filters.action : undefined,
    targetUuid: filters.item,
    search: filters.search?.trim() || undefined,
    limit: FEED_LIMIT,
  });

  const narrowed = Boolean(
    filters.item ||
      isTarget(filters.target) ||
      isAction(filters.action) ||
      filters.search?.trim(),
  );

  return (
    <div className="flex flex-col gap-5">
      <ActivityFilters
        filters={filters}
        itemLabel={entries[0]?.targetLabel}
      />

      {entries.length === FEED_LIMIT && (
        <p className="text-xs text-faint">
          Showing the most recent {FEED_LIMIT} changes — narrow by kind, action or
          search to reach further back.
        </p>
      )}

      <ActivityFeed
        entries={entries}
        filters={filters}
        filtered={narrowed}
      />
    </div>
  );
};

const ActivityPage = async ({ searchParams }: Props) => {
  const filters = await searchParams;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl text-ink">Activity</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Every change to the catalog model, newest first. Rules and assignments
          are what get blamed when a sale is blocked, so &ldquo;why did this cart
          stop, and who turned that rule on?&rdquo; is answerable here rather than
          from memory.
        </p>
      </div>

      <ListSearch placeholder="Search by what changed, or who changed it..." />

      <AsyncSection
        reloadKey={`${filters.search ?? ""}-${filters.target ?? ""}-${filters.action ?? ""}-${filters.item ?? ""}`}
      >
        <Trail filters={filters} />
      </AsyncSection>
    </div>
  );
};

export default ActivityPage;
