import { BrandForm } from "@/components/brands/brand-form";
import { getBrands } from "../action";

const NewBrandPage = async () => {
  const brands = await getBrands();

  return <BrandForm mode="add" brands={brands} />;
};

export default NewBrandPage;
