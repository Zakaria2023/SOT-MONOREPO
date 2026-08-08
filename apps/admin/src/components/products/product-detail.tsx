import type { BoqItemRole, ProductStatus } from "@/db/enum";
import { BOQ_ITEM_ROLE_LABELS, PRODUCT_STATUS_LABELS } from "@/db/label";
import { ProductGallery } from "@/components/products/product-gallery";
import { ProductLinks } from "@/components/products/product-links";
import { documentImageUrl } from "@/lib/documents";
import { ArrowLeft, FileText, Pencil } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  sectionSpecs,
  type CompatibilityLink,
  type CompositionLink,
  type DisplaySpec,
  type ProductDetail as ProductDetailData,
} from "services";
import { PriceWindows } from "@/components/products/price-windows";
import { ProductHistory } from "@/components/products/product-history";
import { formatPrice } from "utils";

type ProductDetailProps = {
  product: ProductDetailData;
  // Resolved and rendered server-side: only the attributes this category carries,
  // only those the reveal currently shows, in the order the category authored.
  // Staff see every audience, which is why the page asks as "admin".
  specs: DisplaySpec[];
  // The two product-to-product facts, authored on this page because each one
  // saves on its own rather than through the edit form's single Save.
  compatibility: CompatibilityLink[];
  composition: CompositionLink[];
  // Everything a link can point at — the catalogue minus this product.
  linkable: { uuid: string; name: string; sku: string | null }[];
};

type FieldProps = {
  label: string;
  value: ReactNode;
};

type SectionProps = {
  title: string;
  children: ReactNode;
};

const STATUS_BADGE_CLASSES: Record<ProductStatus, string> = {
  in_stock: "bg-success-tint text-success",
  out_of_stock: "bg-danger-tint text-danger",
  limited_stock: "bg-warning-tint text-warning",
  pre_order: "bg-primary-tint text-primary",
  in_order: "bg-primary-tint text-primary",
  end_of_sale: "bg-hover text-faint",
  end_of_life: "bg-hover text-faint",
};

const Field = ({ label, value }: FieldProps) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs font-semibold tracking-wide text-faint uppercase">
      {label}
    </span>
    <span className="text-sm text-ink">
      {value === null || value === undefined || value === "" ? (
        <span className="text-faint">—</span>
      ) : (
        value
      )}
    </span>
  </div>
);

const Section = ({ title, children }: SectionProps) => (
  <div className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-6 shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
    <h2 className="font-heading text-lg text-ink">{title}</h2>
    {children}
  </div>
);

export const ProductDetail = ({
  product,
  specs,
  compatibility,
  composition,
  linkable,
}: ProductDetailProps) => {
  const status = product.status ?? "in_stock";
  const gallery = product.images ?? [];
  const sections = sectionSpecs(specs);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/products"
            className="flex h-9 w-9 items-center justify-center rounded-control border border-hairline text-secondary hover:bg-hover"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="font-heading text-2xl text-ink">{product.name}</h1>
            {product.sku && (
              <p className="text-sm text-muted">SKU {product.sku}</p>
            )}
          </div>
        </div>

        <Link
          href={`/products/${product.uuid}/edit`}
          className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          <Pencil size={16} />
          Edit
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-5">
          <Section title="Media">
            <ProductGallery
              name={product.name}
              image={product.image}
              images={gallery}
            />
          </Section>

          <Section title="Descriptions">
            <Field label="Short description" value={product.shortDescription} />
            <Field
              label="Description"
              value={
                product.description ? (
                  <span className="whitespace-pre-wrap leading-relaxed">
                    {product.description}
                  </span>
                ) : null
              }
            />
          </Section>

          <Section title="Technical specifications">
            {sections.length === 0 ? (
              <p className="text-sm text-faint">
                No specifications answered for this product yet.{" "}
                <Link
                  href={`/products/${product.uuid}/edit`}
                  className="text-primary hover:underline"
                >
                  Fill them in
                </Link>
                .
              </p>
            ) : (
              sections.map((section) => (
                <div
                  key={section.name ?? "ungrouped"}
                  className="flex flex-col gap-1.5"
                >
                  {section.name && (
                    <span className="text-xs font-semibold tracking-wide text-faint uppercase">
                      {section.name}
                    </span>
                  )}
                  <dl className="divide-y divide-hairline">
                    {section.specs.map((spec) => (
                      <div
                        key={spec.uuid}
                        className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                      >
                        <dt className="text-sm text-muted">{spec.label}</dt>
                        <dd className="text-sm font-medium text-ink">
                          {spec.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))
            )}
          </Section>

          {/* Below the specs deliberately: both are about how this product sits
              beside others, and the question "what does it not work with" only
              makes sense once you have seen what it is. */}
          <ProductLinks
            productUuid={product.uuid}
            productName={product.name}
            compatibility={compatibility}
            composition={composition}
            linkable={linkable}
          />
        </div>

        <div className="flex flex-col gap-5">
          <Section title="Overview">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[status]}`}
              >
                {PRODUCT_STATUS_LABELS[status]}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  product.isAvailable
                    ? "bg-success-tint text-success"
                    : "bg-danger-tint text-danger"
                }`}
              >
                {product.isAvailable ? "Available" : "Unavailable"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category" value={product.categoryName} />
              <Field label="Brand" value={product.brandName} />
              <Field
                label="System role"
                value={
                  product.systemRole
                    ? BOQ_ITEM_ROLE_LABELS[product.systemRole as BoqItemRole]
                    : null
                }
              />
              <Field label="Model" value={product.model} />
            </div>
          </Section>

          <Section title="Pricing">
            <Field
              label="Undated price (MSRP)"
              value={
                product.price ? (
                  <span className="font-heading text-xl text-ink">
                    {formatPrice(product.price, product.currency)}
                  </span>
                ) : (
                  // It used to read "Set by partner", which is not what an
                  // absent price means: nothing can be ordered without one. The
                  // gate refuses an unpriced line rather than selling it for
                  // nothing, so this is a blocker, not a pricing model.
                  <span className="text-sm text-amber-500">
                    None — this product cannot be ordered
                  </span>
                )
              }
            />

            {/* The dated windows below take precedence over the number above.
                A product with windows is priced by whichever one is in force. */}
            <PriceWindows
              productUuid={product.uuid}
              currency={product.currency ?? "SAR"}
            />
          </Section>

          <Section title="History">
            <ProductHistory productUuid={product.uuid} />
          </Section>

          <Section title="Identity">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Slug" value={product.slug} />
              <Field label="Series code" value={product.seriesCode} />
              <Field
                label="Datasheet"
                value={
                  product.datasheet ? (
                    <a
                      href={documentImageUrl(product.datasheet)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <FileText size={14} />
                      Open PDF
                    </a>
                  ) : null
                }
              />
            </div>
          </Section>

          <Section title="Warranty & origin">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Warranty period" value={product.warrantyPeriod} />
              <Field label="Warranty region" value={product.warrantyRegion} />
              <Field
                label="Country of origin"
                value={product.countryOfOrigin}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
};
