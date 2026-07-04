import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/categories/category-form";
import { getCategories, getCategory } from "../../action";

type Props = {
  params: Promise<{ uuid: string }>;
};

const EditCategoryPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const [category, categories] = await Promise.all([
    getCategory(uuid),
    getCategories(),
  ]);

  if (!category) {
    notFound();
  }

  return (
    <CategoryForm
      mode="edit"
      category={category}
      categories={categories.filter((item) => item.uuid !== uuid)}
    />
  );
};

export default EditCategoryPage;
