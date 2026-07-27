"use client";

import type { LibraryGroup } from "@/app/(dashboard)/library/action";
import { LibraryBuilder } from "@/components/library/library-builder";
import { ProjectInputs } from "@/components/library/project-inputs";
import type { SelectProjectVariables } from "@/db/schema/project-variables";
import { useState } from "react";

type LibraryWorkspaceProps = {
  groups: LibraryGroup[];
  variables: SelectProjectVariables[];
};

type Tab = "attributes" | "inputs";

export const LibraryWorkspace = ({
  groups,
  variables,
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
        <button
          type="button"
          onClick={() => setTab("inputs")}
          className={tabClass(tab === "inputs")}
        >
          Project inputs
          <span className="ml-1.5 text-xs text-faint">{variables.length}</span>
        </button>
      </div>

      {tab === "attributes" ? (
        <LibraryBuilder groups={groups} />
      ) : (
        <ProjectInputs variables={variables} />
      )}
    </div>
  );
};
