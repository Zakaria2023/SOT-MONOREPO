import { RulesTable } from "@/components/rules/rules-table";
import { ListSearch } from "@/components/shared/list-search";
import { Pagination } from "@/components/shared/pagination";
import { FlaskConical, Plus } from "lucide-react";
import Link from "next/link";
import { AsyncSection } from "@/components/shared/async-section";
import { getRulesPage } from "./action";

type Props = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

type RulesListProps = {
  search?: string;
  page?: string;
};

const RulesList = async ({ search, page }: RulesListProps) => {
  const result = await getRulesPage({ search, page });
  return (
    <>
      <RulesTable rules={result.items} />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </>
  );
};

const RulesPage = async ({ searchParams }: Props) => {
  const { search, page } = await searchParams;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl text-ink">
            Compatibility Rules
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/rules/playground"
            className="flex items-center gap-1.5 rounded-control border border-hairline px-4 py-2 text-sm font-semibold text-secondary hover:bg-hover"
          >
            <FlaskConical size={16} />
            Playground
          </Link>
          <Link
            href="/rules/new"
            className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            <Plus size={16} />
            Add Rule
          </Link>
        </div>
      </div>

      <ListSearch placeholder="Search by rule name or spec..." />

      <AsyncSection reloadKey={`${search ?? ""}-${page ?? ""}`}>
        <RulesList search={search} page={page} />
      </AsyncSection>
    </div>
  );
};

export default RulesPage;
