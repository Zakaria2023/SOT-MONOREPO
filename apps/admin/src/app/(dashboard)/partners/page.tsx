import { PartnerRequestsTable } from "@/components/partners/partner-requests-table";
import { ListSearch } from "@/components/shared/list-search";
import { Pagination } from "@/components/shared/pagination";
import { requireAdmin } from "@/lib/server/auth";
import { AsyncSection } from "@/components/shared/async-section";
import { getPartnerRequestsPage } from "./action";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

type PartnersListProps = {
  search?: string;
  page?: string;
};

const PartnersList = async ({ search, page }: PartnersListProps) => {
  const result = await getPartnerRequestsPage({ search, page });
  return (
    <>
      <PartnerRequestsTable requests={result.items} />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </>
  );
};

const PartnersPage = async ({ searchParams }: Props) => {
  await requireAdmin();
  const { search, page } = await searchParams;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl text-ink">Partners</h1>
        <p className="text-sm text-muted">
          Review public partner applications and approve or reject them.
        </p>
      </div>

      <ListSearch placeholder="Search by company, name, or email..." />

      <AsyncSection reloadKey={`${search ?? ""}-${page ?? ""}`}>
        <PartnersList search={search} page={page} />
      </AsyncSection>
    </div>
  );
};

export default PartnersPage;
