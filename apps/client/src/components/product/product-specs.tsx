import type { ProductDetail } from "services";

type ProductSpecsProps = {
  specGroups: NonNullable<ProductDetail["specGroups"]>;
};

export const ProductSpecs = ({ specGroups }: ProductSpecsProps) => {
  if (specGroups.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 pt-16 lg:px-8">
      <h2 className="font-heading text-3xl text-ink">
        Technical specifications
      </h2>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {specGroups.map((group) => (
          <div
            key={group.title}
            className="overflow-hidden rounded-card border border-hairline bg-surface"
          >
            <div className="border-b border-hairline px-5 py-4">
              <h3 className="font-semibold text-ink">{group.title}</h3>
            </div>
            <dl className="divide-y divide-hairline">
              {group.rows.map((row, index) => (
                <div
                  key={`${row.k}-${index}`}
                  className="flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <dt className="text-sm text-faint">{row.k}</dt>
                  <dd className="text-sm font-semibold text-ink">{row.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
};
