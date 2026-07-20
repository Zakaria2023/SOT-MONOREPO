import { CategoriesBoard } from "@/components/categories/categories-board";
import { AsyncSection } from "@/components/shared/async-section";
import { BoardSkeleton } from "@/components/shared/board-skeleton";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getCategoryBoard } from "./action";

const CategoriesBoardSection = async () => {
  const columns = await getCategoryBoard();
  return <CategoriesBoard columns={columns} />;
};

const CategoriesPage = () => (
  <div className="flex flex-col gap-5">
    <div className="flex items-center justify-between">
      <h1 className="font-heading text-2xl text-ink">Categories</h1>

      <Link
        href="/categories/new"
        className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
      >
        <Plus size={16} />
        Add Category
      </Link>
    </div>

    <p className="text-sm text-muted">
      Each column is a parent. Drag a card within its column to reorder, or
      drop it into another column to move it under that parent. Changes save
      automatically.
    </p>

    <AsyncSection reloadKey="categories-board" skeleton={<BoardSkeleton />}>
      <CategoriesBoardSection />
    </AsyncSection>
  </div>
);

export default CategoriesPage;
