import { browseAction } from "@/app/(dashboard)/browse/actions";
import { BrowseView } from "@/components/browse/browse-view";

// Rendered once on the server so the first paint has products in it, then
// filtered live from the client. A screen that starts empty and fills in after a
// round trip reads as broken on a slow connection.
const BrowsePage = async () => {
  const initial = await browseAction({});

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl">Catalogue</h1>
        <p className="text-sm text-muted">
          Filter by category and specification, and add what you need to your
          basket.
        </p>
      </div>

      <BrowseView initial={initial} />
    </div>
  );
};

export default BrowsePage;
