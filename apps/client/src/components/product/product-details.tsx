import { capitalize } from "utils";
import type { ProductDetail } from "services";

type DetailField = {
  label: string;
  value: string;
};

type ProductDetailsProps = {
  product: ProductDetail;
};

export const ProductDetails = ({ product }: ProductDetailsProps) => {
  const fields: DetailField[] = [];
  if (product.brandName) fields.push({ label: "Brand", value: product.brandName });
  if (product.categoryName)
    fields.push({ label: "Category", value: product.categoryName });
  if (product.sku) fields.push({ label: "SKU", value: product.sku });
  if (product.model) fields.push({ label: "Model", value: product.model });
  if (product.productFamily)
    fields.push({ label: "Product Family", value: product.productFamily });
  for (const alias of product.aliases) {
    fields.push({
      label: alias.label ?? capitalize(alias.termType),
      value: alias.searchTerm,
    });
  }
  fields.push({ label: "Featured", value: product.isFeatured ? "Yes" : "No" });
  if (product.status)
    fields.push({ label: "Status", value: capitalize(product.status) });

  if (fields.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 pt-16 lg:px-8">
      <h2 className="font-heading text-3xl text-ink">Product details</h2>

      <div className="mt-8 rounded-card border border-hairline bg-surface p-6">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          {fields.map((field) => (
            <div key={field.label}>
              <dt className="font-grotesk text-xs font-semibold uppercase tracking-wide text-faint">
                {field.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-ink">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};
