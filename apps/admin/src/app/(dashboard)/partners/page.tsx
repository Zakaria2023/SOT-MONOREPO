import { PartnerRequestsTable } from "@/components/partners/partner-requests-table";
import { ListSearch } from "@/components/shared/list-search";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
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
  const { search, page } = await searchParams;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Partners"
        description="Review public partner applications and approve or reject them."
      />

      <ListSearch placeholder="Search by company, name, or email..." />

      <AsyncSection reloadKey={`${search ?? ""}-${page ?? ""}`}>
        <PartnersList search={search} page={page} />
      </AsyncSection>
    </div>
  );
};

export default PartnersPage;
