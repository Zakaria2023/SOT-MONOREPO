import { Playground } from "@/components/rules/playground";
import { getProducts } from "services";

const PlaygroundPage = async () => {
  const products = await getProducts();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl text-ink">Rule Playground</h1>
        <p className="text-sm text-muted">
          Simulate a customer selection and run every enabled compatibility
          rule against it — exactly what the BOQ/solution builder will do.
        </p>
      </div>

      <Playground products={products} />
    </div>
  );
};

export default PlaygroundPage;
