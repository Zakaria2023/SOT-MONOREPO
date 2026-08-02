"use client";

import type { LibraryGroup, OptionSet } from "services";
import { LibraryBuilder } from "@/components/library/library-builder";
import { ProjectInputs } from "@/components/library/project-inputs";
import { SharedLists } from "@/components/library/shared-lists";
import type { SelectCategories } from "@/db/schema/categories";
import type { SelectProjectVariables } from "@/db/schema/project-variables";
import { useState } from "react";

type LibraryWorkspaceProps = {
  groups: LibraryGroup[];
  variables: SelectProjectVariables[];
  categories: SelectCategories[];
  sharedLists: OptionSet[];
};

type Tab = "attributes" | "lists" | "inputs";

export const LibraryWorkspace = ({
  groups,
  variables,
  categories,
  sharedLists,
}: LibraryWorkspaceProps) => {
  const [tab, setTab] = useState<Tab>("attributes");

  const tabClass = (active: boolean): string =>
    `rounded-control px-3 py-1.5 text-sm ${
      active
        ? "bg-primary/15 font-medium text-primary"
        : "text-muted hover:bg-hover hover:text-ink"
    }`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl text-ink">
          Specification library
        </h1>
      </div>

      <div className="flex items-center gap-1 border-b border-hairline pb-2">
        <button
          type="button"
          onClick={() => setTab("attributes")}
          className={tabClass(tab === "attributes")}
        >
          Attributes
        </button>
        {/* Next to Attributes rather than tucked away, because an author choosing
            where a select's options come from needs to know this tab exists. */}
        <button
          type="button"
          onClick={() => setTab("lists")}
          className={tabClass(tab === "lists")}
        >
          Shared lists
          <span className="ml-1.5 text-xs text-faint">
            {sharedLists.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("inputs")}
          className={tabClass(tab === "inputs")}
        >
          Project inputs
          <span className="ml-1.5 text-xs text-faint">{variables.length}</span>
        </button>
      </div>

      {tab === "attributes" && (
        <LibraryBuilder
          groups={groups}
          categories={categories}
          sharedLists={sharedLists}
        />
      )}
      {tab === "lists" && <SharedLists lists={sharedLists} />}
      {tab === "inputs" && <ProjectInputs variables={variables} />}
    </div>
  );
};
