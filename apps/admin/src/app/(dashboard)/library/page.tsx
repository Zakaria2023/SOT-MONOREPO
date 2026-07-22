import { LibraryWorkspace } from "@/components/library/library-workspace";
import { getBuilder } from "./action";

const LibraryPage = async () => {
  const groups = await getBuilder();

  return <LibraryWorkspace groups={groups} />;
};

export default LibraryPage;
