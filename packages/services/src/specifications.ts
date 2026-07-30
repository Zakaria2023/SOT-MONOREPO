import { asc } from "drizzle-orm";
import { db } from "../../../db";
import { SelectSpecifications } from "../../../db/schema/specifications";
import {
  SelectSpecificationGroups,
  SpecificationGroups,
} from "../../../db/schema/specification-groups";
import type {
  ProductValues,
  SpecGroupField,
  SpecOption,
} from "../../../db/types";
import { getCatalogModel, resolveFromModel } from "./catalog-model";
import { visibleAssignments } from "./assignment-resolver";
import { describeValue, readValue } from "./spec-values";

export type { SelectSpecifications };

// ---------------------------------------------------------------------------
// Reading specifications for DISPLAY — the product page's spec table, the
// compare view, the admin detail panel.
//
// Everything here is keyed by uuid, never by a label-derived slug, and every
// value is rendered through the same formatter the engine explains itself with,
// so a product page and a design finding never describe the same value two
// different ways.
// ---------------------------------------------------------------------------

export type ResolvedSpecification = {
  uuid: string;
  label: string;
  type: SelectSpecifications["type"];
  ordered: boolean;
  unit: SelectSpecifications["unit"];
  options: SpecOption[];
  // Only on `group`. Carried because a RULE has to name which column it totals —
  // a rule builder that cannot see the sub-fields cannot offer them, and a group
  // operand without one reads nothing at all.
  groupFields: SpecGroupField[];
  // The library group, so the storefront can section a spec table the same way
  // the library is organised. Null for ungrouped.
  groupName: SelectSpecificationGroups["name"] | null;
};

/**
 * Every definition, already resolved, with its library group's name.
 *
 * Reads the CACHED catalog model rather than querying the definitions again. Two
 * reasons, and the second is the important one:
 *
 *   Cost — warm, this is a single query for the group names instead of a join
 *   across the definitions plus a second read of the shared lists.
 *
 *   Truth — the model has already resolved every borrowed option list. Resolving
 *   them a second time here meant two code paths both claiming to produce "the
 *   resolved definition", and the day one of them learned something the other did
 *   not, a spec table and a design finding would describe the same value
 *   differently. There is now one resolver, and everything reads its output.
 */
const resolvedFromModel = async (): Promise<
  Map<string, ResolvedSpecification>
> => {
  const [model, groupRows] = await Promise.all([
    getCatalogModel(),
    db.select().from(SpecificationGroups),
  ]);
  const groupName = new Map(groupRows.map((group) => [group.uuid, group.name]));

  return new Map(
    model.definitions.map((definition) => [
      definition.uuid,
      {
        uuid: definition.uuid,
        label: definition.label,
        type: definition.type,
        ordered: definition.ordered,
        unit: definition.unit,
        options: definition.options,
        groupFields: definition.groupFields ?? [],
        groupName: definition.groupUuid
          ? (groupName.get(definition.groupUuid) ?? null)
          : null,
      },
    ]),
  );
};

/** Definitions for a set of uuids, in the order given. */
export const getSpecificationsForUuids = async (
  uuids: string[],
): Promise<ResolvedSpecification[]> => {
  if (uuids.length === 0) {
    return [];
  }
  const byUuid = await resolvedFromModel();
  return uuids.flatMap((uuid) => {
    const resolved = byUuid.get(uuid);
    return resolved ? [resolved] : [];
  });
};

export type DisplaySpec = {
  uuid: string;
  label: string;
  value: string;
  groupName: string | null;
};

/**
 * A product's specs, ready to render: only the attributes its category actually
 * carries, only the ones currently revealed, only the ones with a value, in the
 * order the category authored — and hiding anything a shopper must not see.
 *
 * `viewer` is what keeps a staff-only attribute (cost, supplier) off a public
 * product page. Passing "admin" is the authoring view and shows everything.
 */
export const getProductSpecsForDisplay = async (
  categoryUuid: string,
  values: ProductValues,
  viewer: "user" | "partner" | "admin" = "user",
): Promise<DisplaySpec[]> => {
  const model = await getCatalogModel();
  const resolved = resolveFromModel(model, categoryUuid);
  const visible = visibleAssignments(resolved, values);

  const groups = await db
    .select()
    .from(SpecificationGroups)
    .orderBy(asc(SpecificationGroups.order));
  const groupName = new Map(groups.map((group) => [group.uuid, group.name]));

  const specs: DisplaySpec[] = [];
  for (const assignment of visible) {
    const audience = assignment.effectiveAudience;
    const allowed =
      viewer === "admin" || audience === "everyone" || audience === viewer;
    if (!allowed) {
      continue;
    }
    const raw = readValue(values, assignment.definition.uuid);
    const rendered = describeValue(raw, assignment.definition);
    if (rendered === "—") {
      continue;
    }
    specs.push({
      uuid: assignment.definition.uuid,
      label: assignment.definition.label,
      value: rendered,
      groupName: assignment.definition.groupUuid
        ? (groupName.get(assignment.definition.groupUuid) ?? null)
        : null,
    });
  }
  return specs;
};

/**
 * Every definition, for pickers and the AI read model.
 *
 * Order comes from the model, which is already sorted by the library's `order` —
 * so this keeps the sequence an author arranged without re-sorting it.
 */
export const getAllSpecifications = async (): Promise<
  ResolvedSpecification[]
> => [...(await resolvedFromModel()).values()];
