import { AssignmentWorkspace } from "@/components/assignments/assignment-workspace";
import { CategoryTree } from "@/components/assignments/category-tree";
import { AsyncSection } from "@/components/shared/async-section";
import {
  getCategories,
  getCategory,
  getCategoryAssignmentRows,
  getShopperPreview,
  getSpecifications,
} from "services";

type Props = {
  searchParams: Promise<{ category?: string }>;
};

type WorkspaceProps = {
  categoryUuid: string;
};

// The right-hand panel. Everything it needs for all three tabs is loaded here
// so switching tabs and flipping switches stays instant — only changing the
// selected category costs a round trip.
const Workspace = async ({ categoryUuid }: WorkspaceProps) => {
  // The tree already loaded every category for the sidebar; this panel only
  // needs the one it is showing, so it reads a single row rather than the
  // whole table a second time.
  const [category, assignments, library, preview] = await Promise.all([
    getCategory(categoryUuid),
    getCategoryAssignmentRows(categoryUuid),
    getSpecifications(),
    getShopperPreview(categoryUuid),
  ]);

  if (!category) {
    return (
      <p className="rounded-card border border-dashed border-hairline p-10 text-center text-sm text-faint">
        That category no longer exists. Pick another from the tree.
      </p>
    );
  }

  return (
    <AssignmentWorkspace
      categoryUuid={categoryUuid}
      categoryName={category.name}
      categoryPath={category.path}
      assignments={assignments}
      library={library}
      preview={preview}
    />
  );
};

const AssignmentsPage = async ({ searchParams }: Props) => {
  const { category } = await searchParams;
  const categories = await getCategories();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl text-ink">
          Define once, assign down
        </h1>
        <p className="text-sm text-muted">
          An attribute is defined once in the library. A category borrows it
          here and sets only how it is used — everything below inherits, and
          may override.
        </p>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        <aside className="shrink-0 lg:w-72 xl:w-80">
          <CategoryTree categories={categories} selected={category ?? null} />
        </aside>

        <div className="min-w-0 flex-1">
          {category ? (
            <AsyncSection reloadKey={category}>
              <Workspace categoryUuid={category} />
            </AsyncSection>
          ) : (
            <p className="rounded-card border border-dashed border-hairline p-10 text-center text-sm text-faint">
              Pick a category — its attributes are what it inherits, plus its
              own.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignmentsPage;
