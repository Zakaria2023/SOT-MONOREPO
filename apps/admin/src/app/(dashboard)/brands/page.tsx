import { Plus } from "lucide-react";
import Link from "next/link";
import { BrandsTable } from "@/components/brands/brands-table";
import { getBrands } from "./action";

const BrandsPage = async () => {
  const brands = await getBrands();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="font-heading text-2xl font-extrabold text-ink">
            Brands
          </h1>
          <p className="text-sm text-muted">Manage your product brands.</p>
        </div>

        <Link
          href="/brands/new"
          className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          Add Brand
        </Link>
      </div>

      <BrandsTable brands={brands} />
    </div>
  );
};

export default BrandsPage;
