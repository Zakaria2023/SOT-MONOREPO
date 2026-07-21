import { notFound } from "next/navigation";
import { getBrands } from "@/app/(dashboard)/brands/action";
import { getCategories } from "@/app/(dashboard)/categories/action";
import { ProductForm } from "@/components/products/product-form";
import { getSpecificationLibrary } from "services";
import { getProduct } from "../../action";

type Props = {
  params: Promise<{ uuid: string }>;
};

const EditProductPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const [product, categories, brands, library] = await Promise.all([
    getProduct(uuid),
    getCategories(),
    getBrands(),
    getSpecificationLibrary(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <ProductForm
      mode="edit"
      product={product}
      categories={categories}
      brands={brands}
      library={library}
    />
  );
};

export default EditProductPage;
