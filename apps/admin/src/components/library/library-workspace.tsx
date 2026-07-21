"use client";

import { LibraryBuilder } from "@/components/library/library-builder";
import { LibraryDatabase } from "@/components/library/library-database";
import { LibraryTemplates } from "@/components/library/library-templates";
import type {
  LibraryBuilderGroup,
  LibraryReadModel,
  SpecificationTemplate,
} from "@/app/(dashboard)/library/action";
import { Database, LayoutTemplate, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

type LibraryWorkspaceProps = {
  groups: LibraryBuilderGroup[];
  templates: SpecificationTemplate[];
  readModel: LibraryReadModel;
};

type Tab = "builder" | "templates" | "database";

const TABS: { value: Tab; label: string; icon: typeof Database }[] = [
  { value: "builder", label: "Builder", icon: SlidersHorizontal },
  { value: "templates", label: "Templates", icon: LayoutTemplate },
  { value: "database", label: "Database", icon: Database },
];

export const LibraryWorkspace = ({
  groups,
  templates,
  readModel,
}: LibraryWorkspaceProps) => {
  const [tab, setTab] = useState<Tab>("builder");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl text-ink">Specification library</h1>
          <p className="mt-1 text-sm text-muted">
            Shape the library itself — build attributes once, group them, bundle
            templates, and export the read-model your RAG uses to draft BOQs.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-control border border-hairline bg-surface p-1">
          {TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`flex items-center gap-1.5 rounded-[10px] px-3.5 py-1.5 text-sm font-medium transition-colors ${
                tab === value
                  ? "bg-primary text-white"
                  : "text-secondary hover:bg-hover"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "builder" && <LibraryBuilder groups={groups} />}
      {tab === "templates" && (
        <LibraryTemplates templates={templates} groups={groups} />
      )}
      {tab === "database" && <LibraryDatabase readModel={readModel} />}
    </div>
  );
};
