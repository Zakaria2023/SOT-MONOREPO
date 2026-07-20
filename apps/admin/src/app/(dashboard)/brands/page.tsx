import { BrandsBoard } from "@/components/brands/brands-board";
import { AsyncSection } from "@/components/shared/async-section";
import { BoardSkeleton } from "@/components/shared/board-skeleton";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getBrands } from "./action";

const BrandsBoardSection = async () => {
  const brands = await getBrands();
  return <BrandsBoard brands={brands} />;
};

const BrandsPage = () => (
  <div className="flex flex-col gap-5">
    <div className="flex items-center justify-between">
      <h1 className="font-heading text-2xl text-ink">Brands</h1>

      <Link
        href="/brands/new"
        className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
      >
        <Plus size={16} />
        Add Brand
      </Link>
    </div>

    <p className="text-sm text-muted">
      Each column is a parent; drag the cards inside a column to reorder its
      brands. Changes save automatically.
    </p>

    <AsyncSection reloadKey="brands-board" skeleton={<BoardSkeleton />}>
      <BrandsBoardSection />
    </AsyncSection>
  </div>
);

export default BrandsPage;
