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
  // NULL when nothing is selected. Relations are global — they reference
  // attributes, not categories — so they load and render either way. Only the
  // Assignments tab needs a category, and gating the whole screen on one made
  // the rules look as though they did not exist.
  categoryUuid: string | null;
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
  // The three global reads happen whether or not a category is selected; the
  // per-category one is skipped when there is nothing to resolve. A selected
  // category that has since been deleted falls back to the same state as none,
  // rather than replacing the screen — the rules are still there to work on.
  const [category, library, relationships, variables] = await Promise.all([
    categoryUuid ? getCategory(categoryUuid) : null,
    getAllSpecifications(),
    listRelationships(),
    getProjectVariables(),
  ]);

  const assignments = category
    ? await getCategoryAssignments(category.uuid)
    : null;

  return (
    <AssignmentWorkspace
      categoryUuid={category?.uuid ?? null}
      categoryName={category?.name ?? null}
      categoryPath={category?.path ?? null}
      resolved={assignments?.resolved ?? []}
      problems={assignments?.problems ?? []}
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
          {/* Always rendered. Half of this screen — the rules — is global, and
              hiding it behind a category selection did more than inconvenience:
              picking "Switch" and then authoring a rule implies the rule belongs
              to switches. It does not. */}
          <AsyncSection reloadKey={category ?? "all"}>
            <Workspace
              categoryUuid={category ?? null}
              categoryOptions={categoryOptions}
            />
          </AsyncSection>
        </div>
      </div>
    </div>
  );
};

export default AssignmentsPage;
