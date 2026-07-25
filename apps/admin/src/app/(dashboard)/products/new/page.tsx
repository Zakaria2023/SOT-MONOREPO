import { getBrands } from "@/app/(dashboard)/brands/action";
import { getCategories } from "@/app/(dashboard)/categories/action";
import { ProductForm } from "@/components/products/product-form";
import { getProductFormAttributes } from "services";

const NewProductPage = async () => {
  const [categories, brands, attributesByCategory] = await Promise.all([
    getCategories(),
    getBrands(),
    getProductFormAttributes(),
  ]);

  return (
    <ProductForm
      mode="add"
      categories={categories}
      brands={brands}
      attributesByCategory={attributesByCategory}
    />
  );
};

export default NewProductPage;
