import { LibraryWorkspace } from "@/components/library/library-workspace";
import { ValueSweepPanel } from "@/components/library/value-sweep-panel";
import { AsyncSection } from "@/components/shared/async-section";
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
    <div className="flex flex-col gap-8">
      <LibraryWorkspace
        groups={groups}
        variables={variables}
        categories={categories}
        sharedLists={sharedLists}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-lg text-ink">
            Do the products speak this vocabulary?
          </h2>
          <p className="text-sm text-muted">
            A value no option offers is missed by every set comparator, so a rule
            that reads correctly passes the product it was written to catch.
          </p>
        </div>

        <AsyncSection reloadKey="value-sweep">
          <ValueSweepPanel />
        </AsyncSection>
      </div>
    </div>
  );
};

export default LibraryPage;
