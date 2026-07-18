import { PartnerRequestsTable } from "@/components/partners/partner-requests-table";
import { ListSearch } from "@/components/shared/list-search";
import { Pagination } from "@/components/shared/pagination";
import { requireAdmin } from "@/lib/server/auth";
import { getPartnerRequestsPage } from "./action";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

const PartnersPage = async ({ searchParams }: Props) => {
  await requireAdmin();
  const { search, page } = await searchParams;
  const result = await getPartnerRequestsPage({ search, page });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl text-ink">Partners</h1>
        <p className="text-sm text-muted">
          Review public partner applications and approve or reject them.
        </p>
      </div>

      <ListSearch placeholder="Search by company, name, or email..." />

      <PartnerRequestsTable requests={result.items} />

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </div>
  );
};

export default PartnersPage;
