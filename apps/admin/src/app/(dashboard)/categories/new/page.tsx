import { CategoryForm } from "@/components/categories/category-form";
import { getCategories } from "../action";

const NewCategoryPage = async () => {
  const categories = await getCategories();

  return <CategoryForm categories={categories} />;
};

export default NewCategoryPage;
