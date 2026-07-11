import { CatalogProductCard } from "@/components/catalog/catalog-product-card";
import type { ProductListItem } from "services";

type ProductSectionProps = {
  products: ProductListItem[];
  canAdd: boolean;
};

export const ProductSection = ({ products, canAdd }: ProductSectionProps) => (
  <section className="w-full bg-page pt-14 pb-24">
    <div className="mx-auto max-w-6xl px-8">
      <header className="text-center">
        <h2 className="font-heading text-3xl text-ink">
          Hardware in this deployment
        </h2>
      </header>

      <ul className="mt-12 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
        {products.map((product) => (
          <li key={product.uuid}>
            <CatalogProductCard product={product} view="grid" canAdd={canAdd} />
          </li>
        ))}
      </ul>
    </div>
  </section>
);
