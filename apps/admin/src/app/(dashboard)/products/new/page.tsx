import { ProductForm } from "@/components/products/product-form";
import {
  getBrands,
  getCategories,
  getProductFormFieldsByCategory,
  getVariants,
} from "services";

const NewProductPage = async () => {
  const [categories, brands, variants, fieldsByCategory] = await Promise.all([
    getCategories(),
    getBrands(),
    getVariants(),
    getProductFormFieldsByCategory(),
  ]);

  return (
    <ProductForm
      mode="add"
      categories={categories}
      brands={brands}
      variants={variants}
      fieldsByCategory={fieldsByCategory}
    />
  );
};

export default NewProductPage;
