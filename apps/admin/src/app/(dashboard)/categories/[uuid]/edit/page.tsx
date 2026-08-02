import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/categories/category-form";
import { getClassifications } from "@/app/(dashboard)/classifications/action";
import { getCategories, getCategory } from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

const EditCategoryPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const [category, categories, classifications] = await Promise.all([
    getCategory(uuid),
    getCategories(),
    getClassifications(),
  ]);

  if (!category) {
    notFound();
  }

  return (
    <CategoryForm
      mode="edit"
      category={category}
      categories={categories.filter((item) => item.uuid !== uuid)}
      classifications={classifications}
    />
  );
};

export default EditCategoryPage;
