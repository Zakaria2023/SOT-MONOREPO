import { CategoriesBoard } from "@/components/categories/categories-board";
import { getCategoryChildren } from "services";

// The part of the categories screen that waits on data — what the page's
// AsyncSection suspends around.
//
// Straight from services rather than through the action: this renders on the
// server, so it has no need of the action boundary. The action still wraps
// getCategoryChildren for CategoriesBoard, which is a "use client" file and
// does need one to open a column.
export const CategoriesBoardSection = async () => {
  // First render fetches only the top-level cards; each child column is loaded
  // on demand when its parent card is opened.
  const rootItems = await getCategoryChildren(null);

  return <CategoriesBoard rootItems={rootItems} />;
};
