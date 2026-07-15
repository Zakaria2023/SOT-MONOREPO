import { notFound } from "next/navigation";
import { getBrands } from "@/app/(dashboard)/brands/action";
import { getCategories } from "@/app/(dashboard)/categories/action";
import { getVendors } from "@/app/(dashboard)/vendors/action";
import { ProductForm } from "@/components/products/product-form";
import { getSpecifications } from "services";
import { getProduct } from "../../action";

type Props = {
  params: Promise<{ uuid: string }>;
};

const EditProductPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const [product, categories, brands, vendors, specifications] =
    await Promise.all([
      getProduct(uuid),
      getCategories(),
      getBrands(),
      getVendors(),
      getSpecifications(),
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
      vendors={vendors}
      specifications={specifications}
    />
  );
};

export default EditProductPage;
