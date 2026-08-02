import { BoqsList } from "@/components/boqs/boqs-list";
import { AsyncSection } from "@/components/shared/async-section";
import { ListSearch } from "@/components/shared/list-search";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

const BoqsPage = async ({ searchParams }: Props) => {
  const { search, page } = await searchParams;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-2xl text-ink">BOQs</h1>

      <ListSearch placeholder="Search by reference or customer..." />

      <AsyncSection reloadKey={`${search ?? ""}-${page ?? ""}`}>
        <BoqsList search={search} page={page} />
      </AsyncSection>
    </div>
  );
};

export default BoqsPage;
