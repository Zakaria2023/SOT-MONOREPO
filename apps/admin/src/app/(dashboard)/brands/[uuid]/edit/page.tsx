import { notFound } from "next/navigation";
import { BrandForm } from "@/components/brands/brand-form";
import { getBrand, getBrands } from "../../action";

type Props = {
  params: Promise<{ uuid: string }>;
};

const EditBrandPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const [brand, brands] = await Promise.all([getBrand(uuid), getBrands()]);

  if (!brand) {
    notFound();
  }

  return (
    <BrandForm
      mode="edit"
      brand={brand}
      brands={brands.filter((item) => item.uuid !== uuid)}
    />
  );
};

export default EditBrandPage;
