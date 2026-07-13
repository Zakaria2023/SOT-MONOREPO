import { getBrands } from "@/app/(dashboard)/brands/action";
import { getCategories } from "@/app/(dashboard)/categories/action";
import { ProductForm } from "@/components/products/product-form";
import { getSpecifications } from "services";

const NewProductPage = async () => {
  const [categories, brands, specifications] = await Promise.all([
    getCategories(),
    getBrands(),
    getSpecifications(),
  ]);

  return (
    <ProductForm
      mode="add"
      categories={categories}
      brands={brands}
      specifications={specifications}
    />
  );
};

export default NewProductPage;
