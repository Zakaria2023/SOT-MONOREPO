import { LibraryWorkspace } from "@/components/library/library-workspace";
import { getLibraryData, getVariables } from "./action";

const LibraryPage = async () => {
  const [groups, variables] = await Promise.all([
    getLibraryData(),
    getVariables(),
  ]);

  return <LibraryWorkspace groups={groups} variables={variables} />;
};

export default LibraryPage;
