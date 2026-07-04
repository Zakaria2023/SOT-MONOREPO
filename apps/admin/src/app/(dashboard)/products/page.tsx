import { Plus } from "lucide-react";
import Link from "next/link";
import { ProductsTable } from "@/components/products/products-table";
import { getProducts } from "./action";

const ProductsPage = async () => {
  const products = await getProducts();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="font-heading text-2xl font-extrabold text-ink">
            Products
          </h1>
          <p className="text-sm text-muted">Manage your product catalog.</p>
        </div>

        <Link
          href="/products/new"
          className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          Add Product
        </Link>
      </div>

      <ProductsTable products={products} />
    </div>
  );
};

export default ProductsPage;
