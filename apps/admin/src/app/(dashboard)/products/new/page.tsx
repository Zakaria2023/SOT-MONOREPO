import { getBrands } from "@/app/(dashboard)/brands/action";
import { getCategories } from "@/app/(dashboard)/categories/action";
import { ProductForm } from "@/components/products/product-form";
import { getSpecificationLibrary } from "services";

const NewProductPage = async () => {
  const [categories, brands, library] = await Promise.all([
    getCategories(),
    getBrands(),
    getSpecificationLibrary(),
  ]);

  return (
    <ProductForm
      mode="add"
      categories={categories}
      brands={brands}
      library={library}
    />
  );
};

export default NewProductPage;
