import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../../../db";
import {
  SelectSpecifications,
  Specifications,
} from "../../../db/schema/specifications";
import {
  SelectSpecificationGroups,
  SpecificationGroups,
} from "../../../db/schema/specification-groups";
import type { ProductValues, SpecOption } from "../../../db/types";
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
  // The library group, so the storefront can section a spec table the same way
  // the library is organised. Null for ungrouped.
  groupName: SelectSpecificationGroups["name"] | null;
};

/** Definitions for a set of uuids, in the order given. */
export const getSpecificationsForUuids = async (
  uuids: string[],
): Promise<ResolvedSpecification[]> => {
  if (uuids.length === 0) {
    return [];
  }
  const rows = await db
    .select({
      uuid: Specifications.uuid,
      label: Specifications.label,
      type: Specifications.type,
      ordered: Specifications.ordered,
      unit: Specifications.unit,
      options: Specifications.options,
      groupName: SpecificationGroups.name,
    })
    .from(Specifications)
    .leftJoin(
      SpecificationGroups,
      eq(Specifications.groupUuid, SpecificationGroups.uuid),
    )
    .where(inArray(Specifications.uuid, uuids));

  const byUuid = new Map(rows.map((row) => [row.uuid, row]));
  return uuids.flatMap((uuid) => {
    const row = byUuid.get(uuid);
    if (!row) {
      return [];
    }
    return [
      {
        uuid: row.uuid,
        label: row.label,
        type: row.type,
        ordered: row.ordered,
        unit: row.unit,
        options: row.options ?? [],
        groupName: row.groupName,
      },
    ];
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

/** Every definition, for pickers and the AI read model. */
export const getAllSpecifications = async (): Promise<
  ResolvedSpecification[]
> => {
  const rows = await db
    .select({
      uuid: Specifications.uuid,
      label: Specifications.label,
      type: Specifications.type,
      ordered: Specifications.ordered,
      unit: Specifications.unit,
      options: Specifications.options,
      groupName: SpecificationGroups.name,
    })
    .from(Specifications)
    .leftJoin(
      SpecificationGroups,
      eq(Specifications.groupUuid, SpecificationGroups.uuid),
    )
    .orderBy(asc(Specifications.order));

  return rows.map((row) => ({
    uuid: row.uuid,
    label: row.label,
    type: row.type,
    ordered: row.ordered,
    unit: row.unit,
    options: row.options ?? [],
    groupName: row.groupName,
  }));
};
