import { getBrands } from "@/app/(dashboard)/brands/action";
import { getCategories } from "@/app/(dashboard)/categories/action";
import { ProductForm } from "@/components/products/product-form";

const NewProductPage = async () => {
  const [categories, brands] = await Promise.all([
    getCategories(),
    getBrands(),
  ]);

  return <ProductForm mode="add" categories={categories} brands={brands} />;
};

export default NewProductPage;
