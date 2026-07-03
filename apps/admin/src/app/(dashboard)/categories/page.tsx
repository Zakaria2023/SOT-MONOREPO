import { CategoriesTable } from "@/components/categories/categories-table";
import { getCategories } from "./action";

const CategoriesPage = async () => {
  const categories = await getCategories();

  return <CategoriesTable categories={categories} />;
};

export default CategoriesPage;
