import { LibraryWorkspace } from "@/components/library/library-workspace";
import { getBuilder, getReadModel, getTemplates } from "./action";

const LibraryPage = async () => {
  const [groups, templates, readModel] = await Promise.all([
    getBuilder(),
    getTemplates(),
    getReadModel(),
  ]);

  return (
    <LibraryWorkspace
      groups={groups}
      templates={templates}
      readModel={readModel}
    />
  );
};

export default LibraryPage;
