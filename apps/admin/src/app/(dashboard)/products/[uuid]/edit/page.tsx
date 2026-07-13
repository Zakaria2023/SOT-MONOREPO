import { notFound } from "next/navigation";
import { getProductAliases } from "services";
import { getBrands } from "@/app/(dashboard)/brands/action";
import { getCategories } from "@/app/(dashboard)/categories/action";
import { ProductForm } from "@/components/products/product-form";
import { getProduct } from "../../action";

type Props = {
  params: Promise<{ uuid: string }>;
};

const EditProductPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const [product, categories, brands, aliases] = await Promise.all([
    getProduct(uuid),
    getCategories(),
    getBrands(),
    getProductAliases(uuid),
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
      aliases={aliases}
    />
  );
};

export default EditProductPage;
