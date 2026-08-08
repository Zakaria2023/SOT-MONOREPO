import { UsersTable } from "@/components/users/users-table";
import { AsyncSection } from "@/components/shared/async-section";
import { ListSearch } from "@/components/shared/list-search";
import { PageHeader } from "@/components/shared/page-header";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

const UsersPage = async ({ searchParams }: Props) => {
  const { search, page } = await searchParams;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Users"
        description="Everyone with an account, and everything attached to them."
      />

      <ListSearch placeholder="Search by name, email, phone or company..." />

      {/* Keyed on the params so changing the search re-shows the skeleton while
          the new page streams, with the chrome above staying put. */}
      <AsyncSection reloadKey={`${search}-${page}`}>
        <UsersTable search={search} page={page} />
      </AsyncSection>
    </div>
  );
};

export default UsersPage;
