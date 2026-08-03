"use client";

import type { LibraryGroup, OptionSet } from "services";
import type { SpecificationDomain, SpecificationType } from "@/db/enum";
import {
  measurementUnits,
  specificationDomains,
  specificationTypes,
  UNIT_DIMENSIONS,
} from "@/db/enum";
import {
  SPECIFICATION_DOMAIN_LABELS,
  SPECIFICATION_TYPE_LABELS,
} from "@/db/label";

import {
  toDrafts,
  type OptionDraft,
} from "@/components/library/option-list-editor";

import type { SpecGroupField } from "@/db/types";

import {
  ArrowUpDown,
  Hash,
  ListChecks,
  Rows3,
  ToggleLeft,
  Type,
} from "lucide-react";

import { type DropdownOption } from "ui";
/**
 * Vocabulary the library screens share: the option lists the dropdowns are built
 * from, the per-type metadata, and the helpers that read them.
 *
 * These sat at the top of library-builder.tsx, which held eight components and
 * fourteen other declarations in 1524 lines. Naming them here is what let the
 * components move out.
 */
export type LibraryAttribute = LibraryGroup["attributes"][number];

// One row of the sub-field editor, for a `group` attribute. `key` is present on a
// sub-field that already exists, and carrying it through is what keeps a
// product's stored rows readable when its label is edited — a row is an object
// keyed by these, so a re-derived key orphans every row at once.
export type GroupFieldDraft = {
  key?: string;
  label: string;
  kind: "number" | "select";
  unit: string;
  ordered: boolean;
  options: OptionDraft[];
  // "" = this sub-field owns its picks. Anything else is a shared list's uuid,
  // and then `options`/`ordered` above are not shown and not sent.
  optionSetUuid: string;
  // Which of that list's words this column uses. Empty = all of them.
  setValues: string[];
};

export type SearchHit = LibraryAttribute & { groupLabel: string };

// The domain a group is bucketed under on the product picker. "" = no domain,
// which drops the group into the trailing "Other" bucket.
export const DOMAIN_OPTIONS: DropdownOption[] = [
  { value: "", label: "No domain" },
  ...specificationDomains.map((domain) => ({
    value: domain,
    label: SPECIFICATION_DOMAIN_LABELS[domain],
  })),
];

export const domainLabel = (domain: string | null): string => {
  if (!domain) {
    return "No domain";
  }
  return SPECIFICATION_DOMAIN_LABELS[domain as SpecificationDomain] ?? domain;
};

export const TYPE_OPTIONS: DropdownOption[] = specificationTypes.map(
  (type) => ({
    value: type,
    label: SPECIFICATION_TYPE_LABELS[type],
  }),
);

// The two things a sub-field can be. Named for what an author sees rather than
// for the stored kind: a count is a number box, a pick is a dropdown.
export const GROUP_FIELD_KIND_OPTIONS: DropdownOption[] = [
  { value: "number", label: "A count" },
  { value: "select", label: "A pick from a list" },
];

// The unit picker shows what each unit MEASURES, because that is what decides
// whether a rule may compare two attributes. W and kW convert; W and VA never
// do, and the label is where an author finds that out.
export const UNIT_OPTIONS: DropdownOption[] = measurementUnits.map((unit) => {
  const dimension = UNIT_DIMENSIONS[unit];
  return {
    value: unit,
    label: dimension ? `${unit} — ${dimension.dimension}` : unit,
  };
});

export const TYPE_META: Record<
  SpecificationType,
  { badge: string; className: string }
> = {
  number: { badge: "number", className: "bg-blue-500/15 text-blue-400" },
  single_select: {
    badge: "select",
    className: "bg-violet-500/15 text-violet-400",
  },
  multi_select: {
    badge: "multi",
    className: "bg-emerald-500/15 text-emerald-400",
  },
  boolean: { badge: "yes / no", className: "bg-amber-500/15 text-amber-500" },
  group: { badge: "rows", className: "bg-sky-500/15 text-sky-400" },
  // Deliberately the muted one. A free-text attribute feeds nothing, and the
  // badge should not suggest it sits alongside the types that do.
  text: { badge: "text", className: "bg-hover text-secondary" },
};

export const isOptionType = (type: SpecificationType): boolean =>
  type === "single_select" || type === "multi_select";

export const TypeIcon = ({ type }: { type: SpecificationType }) => {
  if (type === "number") {
    return <Hash size={15} className="text-faint" />;
  }
  if (type === "boolean") {
    return <ToggleLeft size={15} className="text-faint" />;
  }
  if (type === "multi_select") {
    return <ListChecks size={15} className="text-faint" />;
  }
  if (type === "group") {
    return <Rows3 size={15} className="text-faint" />;
  }
  if (type === "text") {
    return <Type size={15} className="text-faint" />;
  }
  return <ArrowUpDown size={15} className="text-faint" />;
};

export const toFieldDrafts = (fields: SpecGroupField[]): GroupFieldDraft[] =>
  fields.map((field) => ({
    key: field.key,
    label: field.label,
    kind: field.kind,
    unit: field.unit ?? "",
    ordered: field.ordered,
    options: toDrafts(field.options),
    optionSetUuid: field.optionSetUuid ?? "",
    setValues: field.setValues ?? [],
  }));

// Where a select's options come from. "" is the default and the common case —
// most attributes have no reason to share a vocabulary, and pointing at one is
// how an author says "these two must be comparable".
export const sourceOptions = (sharedLists: OptionSet[]): DropdownOption[] => [
  { value: "", label: "This attribute's own list" },
  ...sharedLists.map((list) => ({
    value: list.uuid,
    label: `${list.name}${list.ordered ? " (a scale)" : ""}`,
  })),
];
