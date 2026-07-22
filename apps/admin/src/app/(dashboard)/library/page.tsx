import { getCategories } from "@/app/(dashboard)/categories/action";
import { LibraryWorkspace } from "@/components/library/library-workspace";
import { getBuilder } from "./action";

const LibraryPage = async () => {
  const [groups, categories] = await Promise.all([
    getBuilder(),
    getCategories(),
  ]);

  return <LibraryWorkspace groups={groups} categories={categories} />;
};

export default LibraryPage;
