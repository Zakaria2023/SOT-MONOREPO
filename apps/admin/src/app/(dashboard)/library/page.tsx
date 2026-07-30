import { LibraryWorkspace } from "@/components/library/library-workspace";
import { getCategories } from "services";
import { getLibraryData, getSharedLists, getVariables } from "./action";

const LibraryPage = async () => {
  const [groups, variables, categories, sharedLists] = await Promise.all([
    getLibraryData(),
    getVariables(),
    getCategories(),
    getSharedLists(),
  ]);

  return (
    <LibraryWorkspace
      groups={groups}
      variables={variables}
      categories={categories}
      sharedLists={sharedLists}
    />
  );
};

export default LibraryPage;
