import { CategoriesTable } from "@/components/categories/categories-table";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getCategories } from "./action";

const CategoriesPage = async () => {
  const categories = await getCategories();

  return (
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

      <CategoriesTable categories={categories} />
    </div>
  );
};

export default CategoriesPage;
