import type { ProductDetail } from "services";

type SpecAttribute = {
  label: string;
  value: string;
};

type ProductSpecsProps = {
  specGroups: NonNullable<ProductDetail["specGroups"]>;
  attributes: SpecAttribute[];
};

export const ProductSpecs = ({ specGroups, attributes }: ProductSpecsProps) => {
  if (specGroups.length === 0 && attributes.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 pt-16 lg:px-8">
      <h2 className="font-heading text-3xl text-ink">
        Technical specifications
      </h2>

      {attributes.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-card border border-hairline bg-surface">
          <dl className="divide-y divide-hairline sm:grid sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
            {attributes.map((attribute) => (
              <div
                key={attribute.label}
                className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3.5"
              >
                <dt className="text-sm text-faint">{attribute.label}</dt>
                <dd className="text-sm font-semibold text-ink">
                  {attribute.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

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
