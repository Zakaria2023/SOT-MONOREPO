import { ProductForm } from "@/components/products/product-form";
import {
  getBrands,
  getCategories,
  getProductFormFieldsByCategory,
} from "services";

const NewProductPage = async () => {
  const [categories, brands, fieldsByCategory] = await Promise.all([
    getCategories(),
    getBrands(),
    getProductFormFieldsByCategory(),
  ]);

  return (
    <ProductForm
      mode="add"
      categories={categories}
      brands={brands}
      fieldsByCategory={fieldsByCategory}
    />
  );
};

export default NewProductPage;
