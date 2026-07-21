import { CatalogProductCard } from "@/components/catalog/catalog-product-card";
import type { ProductListItem } from "services";

type ProductSectionProps = {
  products: ProductListItem[];
  discountPercent?: number;
};

export const ProductSection = ({
  products,
  discountPercent = 0,
}: ProductSectionProps) => (
  <section className="w-full bg-page pt-14 pb-24">
    <div className="mx-auto px-6 lg:px-12 xl:px-20">
      <header className="text-center">
        <h2 className="font-heading text-3xl text-ink">
          Hardware in this deployment
        </h2>
      </header>

      <ul className="mt-12 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
        {products.map((product) => (
          <li key={product.uuid}>
            <CatalogProductCard
              product={product}
              view="grid"
              discountPercent={discountPercent}
            />
          </li>
        ))}
      </ul>
    </div>
  </section>
);
