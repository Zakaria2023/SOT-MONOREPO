import { CategoryTree } from "@/components/assignments/category-tree";
import { WorkspacePanel } from "@/components/assignments/workspace-panel";
import { AsyncSection } from "@/components/shared/async-section";
import { PageHeader } from "@/components/shared/page-header";
import { buildCategoryTreeOptions } from "@/lib/categories";
import { getCategories } from "services";

type Props = {
  searchParams: Promise<{ category?: string }>;
};

const AssignmentsPage = async ({ searchParams }: Props) => {
  const { category } = await searchParams;
  const categories = await getCategories();
  const categoryOptions = buildCategoryTreeOptions(categories);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Define once, assign down" />

      <div className="flex flex-col gap-5 lg:flex-row">
        <aside className="shrink-0 lg:w-72 xl:w-80">
          <CategoryTree categories={categories} selected={category ?? null} />
        </aside>

        <div className="min-w-0 flex-1">
          {/* Always rendered. Half of this screen — the rules — is global, and
              hiding it behind a category selection did more than inconvenience:
              picking "Switch" and then authoring a rule implies the rule belongs
              to switches. It does not. */}
          <AsyncSection reloadKey={category ?? "all"}>
            <WorkspacePanel
              categoryUuid={category ?? null}
              categoryOptions={categoryOptions}
            />
          </AsyncSection>
        </div>
      </div>
    </div>
  );
};

export default AssignmentsPage;
