import { SpecificationForm } from "@/components/specifications/specification-form";
import { getCategories } from "@/app/(dashboard)/categories/action";
import { getSpecificationGroups, getSpecifications } from "services";

const NewSpecificationPage = async () => {
  const [categories, specifications, groups] = await Promise.all([
    getCategories(),
    getSpecifications(),
    getSpecificationGroups(),
  ]);

  return (
    <SpecificationForm
      mode="add"
      categories={categories}
      specifications={specifications}
      groups={groups}
    />
  );
};

export default NewSpecificationPage;
