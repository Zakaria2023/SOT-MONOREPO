"use client";

import { LibraryBuilder } from "@/components/library/library-builder";
import type { LibraryBuilderGroup } from "@/app/(dashboard)/library/action";
import type { SelectCategories } from "@/db/schema/categories";
import { CornerDownRight, GitCompare } from "lucide-react";
import Link from "next/link";

type LibraryWorkspaceProps = {
  groups: LibraryBuilderGroup[];
  categories: SelectCategories[];
};

// The four nested concepts and the two kinds of link are the things people
// conflate, so the page says what each one is before showing the builder.
const Orientation = () => (
  <div className="grid grid-cols-1 gap-4 rounded-card border border-hairline bg-surface p-4 lg:grid-cols-2">
    <div>
      <p className="text-sm font-semibold text-ink">
        Domain <span className="text-faint">›</span> Group{" "}
        <span className="text-faint">›</span> Attribute
      </p>
      <p className="mt-1 text-xs text-muted">
        A <strong className="font-semibold text-secondary">domain</strong>{" "}
        buckets groups on the product picker (Power, Networking). A{" "}
        <strong className="font-semibold text-secondary">group</strong> is the
        folder an attribute lives in.
      </p>
      <p className="mt-1.5 text-xs text-muted">
        A <strong className="font-semibold text-secondary">category</strong> is
        different — it&apos;s the product taxonomy (IP Cameras), and it decides
        which products may use the attribute. Leave it empty and the attribute
        applies everywhere.
      </p>
    </div>

    <div>
      <p className="text-sm font-semibold text-ink">
        Two ways attributes relate
      </p>
      <p className="mt-1 flex items-start gap-1.5 text-xs text-muted">
        <CornerDownRight size={13} className="mt-0.5 shrink-0 text-primary" />
        <span>
          <strong className="font-semibold text-secondary">Auto-add</strong> —
          set here, on an option. Choosing that option adds another attribute to
          the product. Convenience while filling a product in.
        </span>
      </p>
      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted">
        <GitCompare size={13} className="mt-0.5 shrink-0 text-primary" />
        <span>
          <strong className="font-semibold text-secondary">
            Compatibility rules
          </strong>{" "}
          — set in{" "}
          <Link href="/rules" className="text-primary hover:underline">
            Compatibility Rules
          </Link>
          . They validate a selection, e.g. the PoE budget covers the devices.
        </span>
      </p>
    </div>
  </div>
);

export const LibraryWorkspace = ({
  groups,
  categories,
}: LibraryWorkspaceProps) => (
  <div className="flex flex-col gap-5">
    <div>
      <h1 className="font-heading text-2xl text-ink">Specification library</h1>
      <p className="mt-1 text-sm text-muted">
        Build an attribute once, then add it to any product.
      </p>
    </div>

    <Orientation />

    <LibraryBuilder groups={groups} categories={categories} />
  </div>
);
