// ---------------------------------------------------------------------------
// A product's specs, as a surface renders them.
//
// Pure and free of any database import, so the shape and the sectioning can be
// tested directly — the readers that PRODUCE these live in `specifications.ts`
// alongside the queries they need.
// ---------------------------------------------------------------------------

export type DisplaySpec = {
  uuid: string;
  label: string;
  value: string;
  groupName: string | null;
};

export type SpecSection = {
  name: string | null;
  specs: DisplaySpec[];
};

/**
 * A spec list sectioned by library group, groups in FIRST-SEEN order.
 *
 * First-seen, not the groups' own `order`, because the sequence handed in is the
 * one the category authored — re-sorting by group would silently move a row an
 * author deliberately placed. A group that appears again later rejoins its
 * existing section rather than heading a second block, which would read as two
 * groups of the same name. Ungrouped attributes collect under a `null` section.
 *
 * Shared by the storefront spec table and the admin detail panel so the two
 * cannot section the same product differently.
 */
export const sectionSpecs = (specs: DisplaySpec[]): SpecSection[] => {
  const sections: SpecSection[] = [];
  for (const spec of specs) {
    const current = sections.find((section) => section.name === spec.groupName);
    if (current) {
      current.specs.push(spec);
    } else {
      sections.push({ name: spec.groupName, specs: [spec] });
    }
  }
  return sections;
};
