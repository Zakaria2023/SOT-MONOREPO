import { AssignmentWorkspace } from "@/components/assignments/assignment-workspace";
import { CategoryTree } from "@/components/assignments/category-tree";
import { AsyncSection } from "@/components/shared/async-section";
import { buildCategoryTreeOptions } from "@/lib/categories";
import type { DropdownOption } from "ui";
import {
  getAllSpecifications,
  getCategories,
  getCategory,
  getCategoryAssignments,
  getProjectVariables,
  listRelationships,
} from "services";

type Props = {
  searchParams: Promise<{ category?: string }>;
};

type WorkspaceProps = {
  categoryUuid: string;
  // The whole tree, depth-ordered. Passed down rather than re-fetched: the page
  // already loaded it for the sidebar, and a rule's product-group picker needs
  // the same list.
  categoryOptions: DropdownOption[];
};

// The right-hand panel. Everything both tabs need is loaded here so switching
// tabs and flipping switches stays instant — only changing the selected category
// costs a round trip.
//
// Four bounded queries, none of them per-row: the assignment resolution reads the
// in-process catalog model, so this page costs the same whether a category
// carries three attributes or thirty.
const Workspace = async ({ categoryUuid, categoryOptions }: WorkspaceProps) => {
  const category = await getCategory(categoryUuid);
  if (!category) {
    return (
      <p className="rounded-card border border-dashed border-hairline p-10 text-center text-sm text-faint">
        That category no longer exists. Pick another from the tree.
      </p>
    );
  }

  const [assignments, library, relationships, variables] = await Promise.all([
    getCategoryAssignments(categoryUuid),
    getAllSpecifications(),
    listRelationships(),
    getProjectVariables(),
  ]);

  return (
    <AssignmentWorkspace
      categoryUuid={categoryUuid}
      categoryName={category.name}
      categoryPath={category.path}
      resolved={assignments.resolved}
      problems={assignments.problems}
      library={library.map((spec) => ({
        uuid: spec.uuid,
        label: spec.label,
        type: spec.type,
        ordered: spec.ordered,
        unit: spec.unit,
        options: spec.options,
        groupFields: spec.groupFields,
        groupName: spec.groupName,
      }))}
      relationships={relationships}
      categoryOptions={categoryOptions}
      variables={variables.map((variable) => ({
        uuid: variable.uuid,
        label: variable.label,
        unit: variable.unit,
        type: variable.type,
      }))}
    />
  );
};

const AssignmentsPage = async ({ searchParams }: Props) => {
  const { category } = await searchParams;
  const categories = await getCategories();
  const categoryOptions = buildCategoryTreeOptions(categories);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl text-ink">
          Define once, assign down
        </h1>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        <aside className="shrink-0 lg:w-72 xl:w-80">
          <CategoryTree categories={categories} selected={category ?? null} />
        </aside>

        <div className="min-w-0 flex-1">
          {category ? (
            <AsyncSection reloadKey={category}>
              <Workspace
                categoryUuid={category}
                categoryOptions={categoryOptions}
              />
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
