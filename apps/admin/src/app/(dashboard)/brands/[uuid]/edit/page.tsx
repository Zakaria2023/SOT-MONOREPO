import { notFound } from "next/navigation";
import { BrandForm } from "@/components/brands/brand-form";
import { getBrand } from "../../action";

type Props = {
  params: Promise<{ uuid: string }>;
};

const EditBrandPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const brand = await getBrand(uuid);

  if (!brand) {
    notFound();
  }

  return <BrandForm mode="edit" brand={brand} />;
};

export default EditBrandPage;
