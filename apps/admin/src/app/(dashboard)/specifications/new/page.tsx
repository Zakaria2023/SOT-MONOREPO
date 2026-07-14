import { SpecificationForm } from "@/components/specifications/specification-form";
import { getCategories } from "@/app/(dashboard)/categories/action";
import { getSpecifications } from "services";

const NewSpecificationPage = async () => {
  const [categories, specifications] = await Promise.all([
    getCategories(),
    getSpecifications(),
  ]);

  return (
    <SpecificationForm
      mode="add"
      categories={categories}
      specifications={specifications}
    />
  );
};

export default NewSpecificationPage;
