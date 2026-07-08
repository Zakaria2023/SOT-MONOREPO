import { ProductsTable } from "@/components/products/products-table";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getProducts } from "./action";

const ProductsPage = async () => {
  const products = await getProducts();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-ink">Products</h1>

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
