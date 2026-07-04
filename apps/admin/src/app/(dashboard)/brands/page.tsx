import { BrandsTable } from "@/components/brands/brands-table";
import { getBrands } from "./action";

const BrandsPage = async () => {
  const brands = await getBrands();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col">
        <h1 className="font-heading text-2xl font-extrabold text-ink">
          Brands
        </h1>
        <p className="text-sm text-muted">Manage your product brands.</p>
      </div>

      <BrandsTable brands={brands} />
    </div>
  );
};

export default BrandsPage;
