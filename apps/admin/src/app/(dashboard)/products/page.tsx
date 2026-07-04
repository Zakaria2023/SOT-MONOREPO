import { ProductsTable } from "@/components/products/products-table";
import { getProducts } from "./action";

const ProductsPage = async () => {
  const products = await getProducts();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col">
        <h1 className="font-heading text-2xl font-extrabold text-ink">
          Products
        </h1>
        <p className="text-sm text-muted">Manage your product catalog.</p>
      </div>

      <ProductsTable products={products} />
    </div>
  );
};

export default ProductsPage;
