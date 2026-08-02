import { CategoriesBoard } from "@/components/categories/categories-board";
import { AsyncSection } from "@/components/shared/async-section";
import { BoardSkeleton } from "@/components/shared/board-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { getCategoryChildren } from "services";

const CategoriesBoardSection = async () => {
  // First render fetches only the top-level cards; each child column is loaded
  // on demand when its parent card is opened.
  const rootItems = await getCategoryChildren(null);
  return <CategoriesBoard rootItems={rootItems} />;
};

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
