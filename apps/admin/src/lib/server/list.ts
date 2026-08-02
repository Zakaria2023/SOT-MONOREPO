import { requireAdmin } from "@/lib/server/auth";
import { paginate, type ListParams, type PaginatedResult } from "utils";

/**
 * One searched, paginated page of an admin list: check the caller, resolve the
 * page window, hand it to the service, wrap the result.
 *
 * The four list screens — BOQs, offers, partners, government — each wrote these
 * same four lines. `search` is threaded through separately from `limit`/`offset`
 * because `paginate` only knows about paging; filtering is the service's own.
 */
export const adminListPage = async <T>(
  params: ListParams,
  fetchPage: (args: {
    search?: string;
    limit: number;
    offset: number;
  }) => Promise<{ items: T[]; total: number }>,
): Promise<PaginatedResult<T>> => {
  await requireAdmin();

  return paginate(params, ({ limit, offset }) =>
    fetchPage({ search: params.search, limit, offset }),
  );
};
