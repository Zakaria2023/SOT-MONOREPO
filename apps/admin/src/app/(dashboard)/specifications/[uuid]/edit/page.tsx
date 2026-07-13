import { SpecificationForm } from "@/components/specifications/specification-form";
import { getCategories } from "@/app/(dashboard)/categories/action";
import { notFound } from "next/navigation";
import { getSpecification } from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

const EditSpecificationPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const [specification, categories] = await Promise.all([
    getSpecification(uuid),
    getCategories(),
  ]);

  if (!specification) {
    notFound();
  }

  return (
    <SpecificationForm
      mode="edit"
      specification={specification}
      categories={categories}
    />
  );
};

export default EditSpecificationPage;
