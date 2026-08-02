import { GovernmentList } from "@/components/government/government-list";
import { AsyncSection } from "@/components/shared/async-section";
import { ListSearch } from "@/components/shared/list-search";
import { PageHeader } from "@/components/shared/page-header";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

const GovernmentPage = async ({ searchParams }: Props) => {
  const { search, page } = await searchParams;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Government"
        description="Review government access requests and invite approved entities."
      />

      <ListSearch placeholder="Search by entity, name, or email..." />

      <AsyncSection reloadKey={`${search ?? ""}-${page ?? ""}`}>
        <GovernmentList search={search} page={page} />
      </AsyncSection>
    </div>
  );
};

export default GovernmentPage;
