import { CatalogProductCard } from "@/components/catalog/catalog-product-card";
import { documentDownloadUrl } from "@/lib/documents";
import { Tag } from "lucide-react";
import Image from "next/image";
import type { ProductListItem, SelectBrands } from "services";

type BrandProductsProps = {
  brand: SelectBrands;
  products: ProductListItem[];
  canAdd: boolean;
};

export const BrandProducts = ({
  brand,
  products,
  canAdd,
}: BrandProductsProps) => (
  <main className="min-h-screen bg-page">
    <div className="mx-auto max-w-6xl px-6 py-14 lg:px-8">
      <p className="font-grotesk text-xs font-bold tracking-widest text-primary uppercase">
        Shop by brand
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-5">
        <div className="relative flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-hairline bg-surface-2">
          {brand.image ? (
            <Image
              src={documentDownloadUrl(brand.image)}
              alt={brand.name}
              fill
              unoptimized
              className="object-contain p-3"
            />
          ) : (
            <Tag size={32} className="text-primary/30" />
          )}
        </div>

        <div>
          <h1 className="font-heading text-4xl leading-tight text-ink">
            {brand.name}
          </h1>
          {brand.description && (
            <p className="font-grotesk mt-2 max-w-xl text-base leading-relaxed text-muted">
              {brand.description}
            </p>
          )}
          <p className="font-grotesk mt-2 text-sm text-faint">
            {products.length} {products.length === 1 ? "product" : "products"}{" "}
            from this brand
          </p>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="font-grotesk mt-10 rounded-2xl border border-hairline bg-surface p-10 text-center text-sm text-faint">
          This brand has no products yet.
        </p>
      ) : (
        <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <li key={product.uuid}>
              <CatalogProductCard
                product={product}
                view="grid"
                canAdd={canAdd}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  </main>
);
