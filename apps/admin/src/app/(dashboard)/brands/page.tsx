import { BrandsBoardSection } from "@/components/brands/brands-board-section";
import { AsyncSection } from "@/components/shared/async-section";
import { BoardSkeleton } from "@/components/shared/board-skeleton";
import { PageHeader } from "@/components/shared/page-header";

const BrandsPage = () => (
  <div className="flex flex-col gap-5">
    <PageHeader
      title="Brands"
      action={{ href: "/brands/new", label: "Add Brand" }}
    />

    <AsyncSection reloadKey="brands-board" skeleton={<BoardSkeleton />}>
      <BrandsBoardSection />
    </AsyncSection>
  </div>
);

export default BrandsPage;
