import { notFound } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import {
  getBrands,
  getCategories,
  getProduct,
  getProductFormFieldsByCategory,
  getVariants,
} from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

const EditProductPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const [product, categories, brands, variants, fieldsByCategory] =
    await Promise.all([
      getProduct(uuid),
      getCategories(),
      getBrands(),
      getVariants(),
      getProductFormFieldsByCategory(),
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
      variants={variants}
      fieldsByCategory={fieldsByCategory}
    />
  );
};

export default EditProductPage;
