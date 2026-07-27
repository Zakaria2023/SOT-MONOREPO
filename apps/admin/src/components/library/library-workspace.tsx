"use client";

import type { LibraryGroup } from "@/app/(dashboard)/library/action";
import { LibraryBuilder } from "@/components/library/library-builder";
import { ProjectInputs } from "@/components/library/project-inputs";
import type { SelectProjectVariables } from "@/db/schema/project-variables";
import { GitCompare, Layers, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type LibraryWorkspaceProps = {
  groups: LibraryGroup[];
  variables: SelectProjectVariables[];
};

type Tab = "attributes" | "inputs";

// The three objects are what people conflate, so the page states the boundary
// before showing anything. It is the same boundary the code enforces: a
// definition here may never mention another attribute, because the moment it can,
// it has become an assignment and there are two places to look.
const Orientation = () => (
  <div className="grid grid-cols-1 gap-4 rounded-card border border-hairline bg-surface p-4 lg:grid-cols-3">
    <div>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Layers size={14} className="text-primary" />
        Here: what an attribute IS
      </p>
      <p className="mt-1 text-xs text-muted">
        Name, type, unit, and the master option list. Authored once — every
        category that uses it points at this one definition, which is what makes
        1G on a switch and 1G on a NAS the same value to a rule.
      </p>
    </div>

    <div>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <SlidersHorizontal size={14} className="text-primary" />
        <Link href="/assignments" className="hover:underline">
          Assignments: how a category uses it
        </Link>
      </p>
      <p className="mt-1 text-xs text-muted">
        Whether the shopper sees it, whether the engine reads it, which slice of
        the options this category offers, and what reveals it. Nothing about a
        category lives on this page.
      </p>
    </div>

    <div>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <GitCompare size={14} className="text-primary" />
        <Link href="/assignments" className="hover:underline">
          Relations: how two items fit
        </Link>
      </p>
      <p className="mt-1 text-xs text-muted">
        A camera&apos;s draw against a switch&apos;s budget. Rules reference
        attributes, never products, so a new SKU joins every existing rule as
        soon as its values are filled in.
      </p>
    </div>
  </div>
);

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
        <p className="mt-1 text-sm text-muted">
          Define an attribute once, then let any category borrow it.
        </p>
      </div>

      <Orientation />

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
