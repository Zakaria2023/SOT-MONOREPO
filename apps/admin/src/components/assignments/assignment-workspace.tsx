"use client";

import { AssignmentsTab } from "@/components/assignments/assignments-tab";
import type { PredicateAttribute } from "@/components/assignments/condition-picker";
import {
  RelationBuilder,
  type RelationVariable,
} from "@/components/assignments/relation-builder";
import type { SelectRelationships } from "@/db/schema/relationships";
import type { DropdownOption } from "ui";
import { useState } from "react";
import type { ResolvedAssignment, RevealProblem } from "services";

type AssignmentWorkspaceProps = {
  categoryUuid: string;
  categoryName: string;
  categoryPath: string | null;
  resolved: ResolvedAssignment[];
  problems: RevealProblem[];
  library: PredicateAttribute[];
  relationships: SelectRelationships[];
  variables: RelationVariable[];
  // The whole tree, for the product-group picker on a rule. Not the selected
  // category's subtree — a rule relates one part of the tree to another.
  categoryOptions: DropdownOption[];
};

type Tab = "assignments" | "relations";

export const AssignmentWorkspace = ({
  categoryUuid,
  categoryName,
  categoryPath,
  resolved,
  problems,
  library,
  relationships,
  variables,
  categoryOptions,
}: AssignmentWorkspaceProps) => {
  const [tab, setTab] = useState<Tab>("assignments");

  const tabClass = (active: boolean): string =>
    `rounded-control px-3 py-1.5 text-sm ${
      active
        ? "bg-primary/15 font-medium text-primary"
        : "text-muted hover:bg-hover hover:text-ink"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-2">
        {categoryPath && (
          <span className="font-mono text-xs text-faint">{categoryPath}</span>
        )}
        <h2 className="font-heading text-lg text-ink">{categoryName}</h2>
      </div>

      <div className="flex items-center gap-1 border-b border-hairline pb-2">
        <button
          type="button"
          onClick={() => setTab("assignments")}
          className={tabClass(tab === "assignments")}
        >
          Assignments
          <span className="ml-1.5 text-xs text-faint">{resolved.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("relations")}
          className={tabClass(tab === "relations")}
        >
          Relations
          <span className="ml-1.5 text-xs text-faint">
            {relationships.length}
          </span>
        </button>
      </div>

      {tab === "assignments" ? (
        <AssignmentsTab
          categoryUuid={categoryUuid}
          resolved={resolved}
          problems={problems}
          library={library}
        />
      ) : (
        // Relations are global — they reference attributes, not categories — so
        // the same list shows whichever category is selected. Keeping them on
        // this page is deliberate: an author writes a rule right after assigning
        // the attributes it reads.
        <RelationBuilder
          relationships={relationships}
          // Free text is left OUT of the rule builder entirely, rather than
          // offered and then refused on save. Nothing in a sentence can be added
          // up or compared, so an attribute an author cannot use here should not
          // appear here — the save-time guard exists for rules written before the
          // type did, not as the place an author finds out.
          attributes={library.filter((attribute) => attribute.type !== "text")}
          variables={variables}
          categoryOptions={categoryOptions}
        />
      )}
    </div>
  );
};
