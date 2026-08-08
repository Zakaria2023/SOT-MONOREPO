import { PasteImportForm } from "@/components/imports/paste-import-form";
import { PageHeader } from "@/components/shared/page-header";
import { getBrands, getCategories } from "services";

const NewImportPage = async () => {
  const [categories, brands] = await Promise.all([
    getCategories(),
    getBrands(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="New import" />
      <PasteImportForm categories={categories} brands={brands} />
    </div>
  );
};

export default NewImportPage;
