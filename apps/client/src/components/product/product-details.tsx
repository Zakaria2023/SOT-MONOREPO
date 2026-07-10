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
  if (product.partNumber)
    fields.push({ label: "Part Number (PN)", value: product.partNumber });
  if (product.modelNumber)
    fields.push({ label: "Model Number (MN)", value: product.modelNumber });
  if (typeof product.stock === "number")
    fields.push({ label: "Stock", value: `${product.stock} units` });
  fields.push({ label: "Featured", value: product.isFeatured ? "Yes" : "No" });
  if (product.status)
    fields.push({ label: "Status", value: capitalize(product.status) });

  const hasBom = Boolean(product.bom && product.bom.trim());
  if (fields.length === 0 && !hasBom) return null;

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

        {hasBom && (
          <div className="mt-6 border-t border-hairline pt-5">
            <p className="font-grotesk text-xs font-semibold uppercase tracking-wide text-faint">
              Bill of Materials (BOM)
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
              {product.bom}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
