import { SpecificationForm } from "@/components/specifications/specification-form";
import { getCategories } from "@/app/(dashboard)/categories/action";

const NewSpecificationPage = async () => {
  const categories = await getCategories();

  return <SpecificationForm mode="add" categories={categories} />;
};

export default NewSpecificationPage;
