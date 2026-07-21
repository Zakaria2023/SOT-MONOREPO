import { CategoryForm } from "@/components/categories/category-form";
import { getClassifications } from "@/app/(dashboard)/classifications/action";
import { getCategories } from "../action";

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
