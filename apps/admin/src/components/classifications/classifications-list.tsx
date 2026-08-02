import { ClassificationsTable } from "@/components/classifications/classifications-table";
import { getClassifications } from "services";

// The part of the classifications screen that waits on data — what the page's
// AsyncSection suspends around. There is no search or paging here: the list is
// small and bounded, so it loads whole.
export const ClassificationsList = async () => {
  const classifications = await getClassifications();

  return <ClassificationsTable classifications={classifications} />;
};
