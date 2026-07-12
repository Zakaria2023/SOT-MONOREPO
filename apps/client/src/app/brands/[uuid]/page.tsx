import { BrandProducts } from "@/components/brand/brand-products";
import { getCurrentUser } from "@/lib/auth";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrand, getProductsByBrand } from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

export const generateMetadata = async ({
  params,
}: Props): Promise<Metadata> => {
  const { uuid } = await params;
  const brand = await getBrand(uuid);
  return {
    title: brand ? `${brand.name} · SOT Solutions` : "Brand",
  };
};

const BrandPage = async ({ params }: Props) => {
  const { uuid } = await params;
  const [brand, products, user] = await Promise.all([
    getBrand(uuid),
    getProductsByBrand(uuid),
    getCurrentUser(),
  ]);

  if (!brand) {
    notFound();
  }

  return (
    <BrandProducts brand={brand} products={products} canAdd={Boolean(user)} />
  );
};

export default BrandPage;
