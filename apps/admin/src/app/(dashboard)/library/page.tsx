import { LibraryWorkspace } from "@/components/library/library-workspace";
import { getCategories } from "services";
import { getLibraryData, getVariables } from "./action";

const LibraryPage = async () => {
  const [groups, variables, categories] = await Promise.all([
    getLibraryData(),
    getVariables(),
    getCategories(),
  ]);

  return (
    <LibraryWorkspace
      groups={groups}
      variables={variables}
      categories={categories}
    />
  );
};

export default LibraryPage;
