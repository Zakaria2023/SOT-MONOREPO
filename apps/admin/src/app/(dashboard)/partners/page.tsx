import { PartnersList } from "@/components/partners/partners-list";
import { AsyncSection } from "@/components/shared/async-section";
import { ListSearch } from "@/components/shared/list-search";
import { PageHeader } from "@/components/shared/page-header";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
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
