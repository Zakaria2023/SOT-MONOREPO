import { CategoriesBoardSection } from "@/components/categories/categories-board-section";
import { AsyncSection } from "@/components/shared/async-section";
import { BoardSkeleton } from "@/components/shared/board-skeleton";
import { PageHeader } from "@/components/shared/page-header";

const CategoriesPage = () => (
  <div className="flex flex-col gap-5">
    <PageHeader
      title="Categories"
      action={{ href: "/categories/new", label: "Add Category" }}
    />

    <AsyncSection reloadKey="categories-board" skeleton={<BoardSkeleton />}>
      <CategoriesBoardSection />
    </AsyncSection>
  </div>
);

export default CategoriesPage;
