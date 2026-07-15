import { getBrands } from "@/app/(dashboard)/brands/action";
import { getCategories } from "@/app/(dashboard)/categories/action";
import { getVendors } from "@/app/(dashboard)/vendors/action";
import { ProductForm } from "@/components/products/product-form";
import { getSpecifications } from "services";

const NewProductPage = async () => {
  const [categories, brands, vendors, specifications] = await Promise.all([
    getCategories(),
    getBrands(),
    getVendors(),
    getSpecifications(),
  ]);

  return (
    <ProductForm
      mode="add"
      categories={categories}
      brands={brands}
      vendors={vendors}
      specifications={specifications}
    />
  );
};

export default NewProductPage;
