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
import type { DisplaySpec } from "./display-specs";
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

export type ComparisonProduct = {
  uuid: string;
  values: ProductValues;
};

export type ComparisonRow = {
  uuid: string;
  label: string;
  groupName: string | null;
  // productUuid → rendered value. A product with nothing to say for this row is
  // absent from the map rather than holding a dash, so the caller decides how a
  // gap looks. A row every product is silent on is not returned at all.
  values: Record<string, string>;
};

/**
 * One spec table across several products of the SAME category — the compare view.
 *
 * Batched on purpose: `getProductSpecsForDisplay` per product would repeat the
 * group-name read once per column. This is a FIXED two reads (the cached model
 * plus the groups) however many products are compared.
 *
 * The reveal is evaluated per product, because that is what it means: a switch
 * with PoE off has no PoE Budget row of its own, while the switch beside it does.
 * Row ORDER comes from the resolved assignments, so the table reads in the order
 * the category authored regardless of which product happens to answer first.
 */
export const getComparisonSpecs = async (
  categoryUuid: string,
  products: ComparisonProduct[],
  viewer: "user" | "partner" | "admin" = "user",
): Promise<ComparisonRow[]> => {
  if (products.length === 0) {
    return [];
  }

  const model = await getCatalogModel();
  const resolved = resolveFromModel(model, categoryUuid);
  const groups = await db
    .select()
    .from(SpecificationGroups)
    .orderBy(asc(SpecificationGroups.order));
  const groupName = new Map(groups.map((group) => [group.uuid, group.name]));

  const columns = products.map((product) => ({
    uuid: product.uuid,
    values: product.values,
    visible: new Set(
      visibleAssignments(resolved, product.values).map(
        (assignment) => assignment.definition.uuid,
      ),
    ),
  }));

  const rows: ComparisonRow[] = [];
  for (const assignment of resolved) {
    const audience = assignment.effectiveAudience;
    const allowed =
      viewer === "admin" || audience === "everyone" || audience === viewer;
    if (!allowed) {
      continue;
    }
    const { definition } = assignment;

    const values: Record<string, string> = {};
    for (const column of columns) {
      if (!column.visible.has(definition.uuid)) {
        continue;
      }
      const rendered = describeValue(
        readValue(column.values, definition.uuid),
        definition,
      );
      if (rendered === "—") {
        continue;
      }
      values[column.uuid] = rendered;
    }
    // Nothing to compare: every product is either silent or hiding this row.
    if (Object.keys(values).length === 0) {
      continue;
    }

    rows.push({
      uuid: definition.uuid,
      label: definition.label,
      groupName: definition.groupUuid
        ? (groupName.get(definition.groupUuid) ?? null)
        : null,
      values,
    });
  }
  return rows;
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
