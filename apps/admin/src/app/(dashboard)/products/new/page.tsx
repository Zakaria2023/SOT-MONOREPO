import { getCategories } from "@/app/(dashboard)/categories/action";
import { ProductForm } from "@/components/products/product-form";
import { getBrands, getProductFormFieldsByCategory } from "services";

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
