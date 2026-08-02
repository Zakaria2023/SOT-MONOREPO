import { CategoryForm } from "@/components/categories/category-form";
import { getCategories, getClassifications } from "services";

const NewCategoryPage = async () => {
  const [categories, classifications] = await Promise.all([
    getCategories(),
    getClassifications(),
  ]);

  return (
    <CategoryForm
      mode="add"
      categories={categories}
      classifications={classifications}
    />
  );
};

export default NewCategoryPage;
