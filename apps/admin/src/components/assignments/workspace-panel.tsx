import {
  getAllSpecifications,
  getCategory,
  getCategoryAssignments,
  getProjectVariables,
  listRelationships,
} from "services";
import { DropdownOption } from "ui";
import { AssignmentWorkspace } from "./assignment-workspace";

type WorkspacePanelProps = {
  // NULL when nothing is selected. Relations are global — they reference
  // attributes, not categories — so they load and render either way. Only the
  // Assignments tab needs a category, and gating the whole screen on one made
  // the rules look as though they did not exist.
  categoryUuid: string | null;
  // The whole tree, depth-ordered. Passed in rather than re-fetched: the page
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
export const WorkspacePanel = async ({
  categoryUuid,
  categoryOptions,
}: WorkspacePanelProps) => {
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
