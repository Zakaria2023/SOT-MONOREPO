"use client";

import { LibraryBuilder } from "@/components/library/library-builder";
import type { LibraryBuilderGroup } from "@/app/(dashboard)/library/action";
import type { SelectCategories } from "@/db/schema/categories";

type LibraryWorkspaceProps = {
  groups: LibraryBuilderGroup[];
  categories: SelectCategories[];
};

export const LibraryWorkspace = ({
  groups,
  categories,
}: LibraryWorkspaceProps) => (
  <div className="flex flex-col gap-5">
    <div>
      <h1 className="font-heading text-2xl text-ink">Specification library</h1>
      <p className="mt-1 text-sm text-muted">
        Shape the library itself — build attributes once and group them by
        function.
      </p>
    </div>

    <LibraryBuilder groups={groups} categories={categories} />
  </div>
);
