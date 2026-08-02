import { BrandsBoard } from "@/components/brands/brands-board";
import { getBrandChildren } from "services";

// The part of the brands screen that waits on data — what the page's
// AsyncSection suspends around.
//
// Straight from services rather than through the action: this renders on the
// server, so it has no need of the action boundary. The action still wraps
// getBrandChildren for BrandsBoard, which is a "use client" file and does need
// one to open a column.
export const BrandsBoardSection = async () => {
  // First render fetches only the top-level cards; each child column is loaded
  // on demand when its parent card is opened.
  const rootItems = await getBrandChildren(null);

  return <BrandsBoard rootItems={rootItems} />;
};
