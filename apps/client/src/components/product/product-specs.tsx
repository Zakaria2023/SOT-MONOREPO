type SpecAttribute = {
  label: string;
  value: string;
};

type ProductSpecsProps = {
  attributes: SpecAttribute[];
};

export const ProductSpecs = ({ attributes }: ProductSpecsProps) => {
  if (attributes.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto px-6 pt-16 lg:px-12 xl:px-20">
      <h2 className="font-heading text-3xl text-ink">
        Technical specifications
      </h2>

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
    </section>
  );
};
