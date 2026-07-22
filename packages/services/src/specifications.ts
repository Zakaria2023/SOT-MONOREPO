import { randomUUID } from "node:crypto";
import { asc, count, eq, inArray, like, or } from "drizzle-orm";
import { db } from "../../../db";
import { specificationDomains } from "../../../db/enum";
import { Categories } from "../../../db/schema/categories";
import {
  InsertSpecifications,
  SelectSpecifications,
  Specifications,
} from "../../../db/schema/specifications";
import { SpecificationCategories } from "../../../db/schema/specification-categories";
import {
  SelectSpecificationGroups,
  SpecificationGroups,
} from "../../../db/schema/specification-groups";
import { SpecField } from "../../../db/types";

export type { SelectSpecifications };

export type SpecificationFields = Omit<
  InsertSpecifications,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

// A specification enriched with the categories it's directly assigned to.
export type SpecificationWithCategories = SelectSpecifications & {
  groupName: SelectSpecificationGroups["name"] | null;
  categoryUuids: string[];
  categoryNames: string[];
};

// A library attribute carries the categories it's assigned to, so the product
// picker can narrow the library to the product's category. An attribute with
// no categories is universal — it applies to every category.
export type LibrarySpecification = SelectSpecifications & {
  categoryUuids: string[];
};

// The library as domains → groups → attributes, for the admin library view and
// the product attribute picker.
export type LibraryGroup = {
  group: SelectSpecificationGroups;
  attributes: LibrarySpecification[];
};

export type LibraryDomain = {
  domain: string | null;
  groups: LibraryGroup[];
};

/**
 * The whole specification library, bucketed by navigation domain (in enum
 * order) then group (in group order), each group carrying its attributes.
 * Groups with no/unknown domain, and attributes with no group, fall into a
 * trailing "Other" bucket so nothing is ever hidden.
 */
export const getSpecificationLibrary = async (): Promise<LibraryDomain[]> => {
  const [groups, specs, categoryLinks] = await Promise.all([
    db
      .select()
      .from(SpecificationGroups)
      .orderBy(asc(SpecificationGroups.order)),
    db.select().from(Specifications).orderBy(asc(Specifications.order)),
    db
      .select({
        specificationUuid: SpecificationCategories.specificationUuid,
        categoryUuid: SpecificationCategories.categoryUuid,
      })
      .from(SpecificationCategories),
  ]);

  const categoriesBySpec = new Map<string, string[]>();
  for (const link of categoryLinks) {
    const list = categoriesBySpec.get(link.specificationUuid) ?? [];
    list.push(link.categoryUuid);
    categoriesBySpec.set(link.specificationUuid, list);
  }

  const specsByGroup = new Map<string, LibrarySpecification[]>();
  const ungrouped: LibrarySpecification[] = [];
  for (const row of specs) {
    const spec: LibrarySpecification = {
      ...row,
      categoryUuids: categoriesBySpec.get(row.uuid) ?? [],
    };
    if (!spec.groupUuid) {
      ungrouped.push(spec);
      continue;
    }
    const list = specsByGroup.get(spec.groupUuid) ?? [];
    list.push(spec);
    specsByGroup.set(spec.groupUuid, list);
  }

  const knownDomains = specificationDomains as readonly string[];
  const byDomain = new Map<string, LibraryGroup[]>();
  const otherGroups: LibraryGroup[] = [];
  for (const group of groups) {
    const libraryGroup: LibraryGroup = {
      group,
      attributes: specsByGroup.get(group.uuid) ?? [],
    };
    if (group.domain && knownDomains.includes(group.domain)) {
      const list = byDomain.get(group.domain) ?? [];
      list.push(libraryGroup);
      byDomain.set(group.domain, list);
    } else {
      otherGroups.push(libraryGroup);
    }
  }

  const domains: LibraryDomain[] = [];
  for (const domain of specificationDomains) {
    const groupsInDomain = byDomain.get(domain);
    if (groupsInDomain && groupsInDomain.length > 0) {
      domains.push({ domain, groups: groupsInDomain });
    }
  }

  if (otherGroups.length > 0 || ungrouped.length > 0) {
    const trailing = [...otherGroups];
    if (ungrouped.length > 0) {
      trailing.push({
        group: {
          id: 0,
          uuid: "",
          name: "Ungrouped",
          domain: null,
          order: Number.MAX_SAFE_INTEGER,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        attributes: ungrouped,
      });
    }
    domains.push({ domain: null, groups: trailing });
  }

  return domains;
};

// A resolved attribute for display: its label and unit, for a product's chosen
// spec keys. Returned in the given key order; keys with no matching attribute
// (deleted/renamed) fall back to the key as the label.
export type ResolvedSpecification = {
  key: string;
  label: string;
  unit: SelectSpecifications["unit"];
  // The library group it belongs to, so the storefront can section the spec
  // table the same way the library is organised. Null for ungrouped.
  groupName: SelectSpecificationGroups["name"] | null;
};

export const getSpecificationsForKeys = async (
  keys: string[],
): Promise<ResolvedSpecification[]> => {
  if (keys.length === 0) {
    return [];
  }
  const rows = await db
    .select({
      key: Specifications.key,
      label: Specifications.label,
      unit: Specifications.unit,
      groupName: SpecificationGroups.name,
    })
    .from(Specifications)
    .leftJoin(
      SpecificationGroups,
      eq(Specifications.groupUuid, SpecificationGroups.uuid),
    )
    .where(inArray(Specifications.key, keys));
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return keys.map(
    (key) => byKey.get(key) ?? { key, label: key, unit: null, groupName: null },
  );
};

/** All specifications, each with the categories it's directly assigned to. */
export const getSpecifications = async (): Promise<
  SpecificationWithCategories[]
> => {
  try {
    const specRows = await db
      .select({
        spec: Specifications,
        groupName: SpecificationGroups.name,
      })
      .from(Specifications)
      .leftJoin(
        SpecificationGroups,
        eq(Specifications.groupUuid, SpecificationGroups.uuid),
      )
      .orderBy(asc(Specifications.order));
    const specs = specRows.map((row) => ({
      ...row.spec,
      groupName: row.groupName,
    }));

    const links = await db
      .select({
        specificationUuid: SpecificationCategories.specificationUuid,
        categoryUuid: SpecificationCategories.categoryUuid,
        categoryName: Categories.name,
      })
      .from(SpecificationCategories)
      .leftJoin(
        Categories,
        eq(SpecificationCategories.categoryUuid, Categories.uuid),
      );

    return specs.map((spec) => {
      const own = links.filter((link) => link.specificationUuid === spec.uuid);
      return {
        ...spec,
        categoryUuids: own.map((link) => link.categoryUuid),
        categoryNames: own.map((link) => link.categoryName ?? ""),
      };
    });
  } catch (error) {
    console.error("getSpecifications failed:", error);
    throw new Error("Failed to fetch specifications", { cause: error });
  }
};

export type SpecificationListParams = {
  search?: string;
  limit: number;
  offset: number;
};

// A searched + paginated page of specifications, each enriched with the
// categories it's directly assigned to, plus the unfiltered total for that
// search. Returns raw rows + total; the caller assembles the page metadata.
export const getSpecificationsList = async (
  params: SpecificationListParams,
): Promise<{ items: SpecificationWithCategories[]; total: number }> => {
  const term = params.search?.trim();
  const where = term
    ? or(
        like(Specifications.label, `%${term}%`),
        like(Specifications.key, `%${term}%`),
      )
    : undefined;

  try {
    const [specRows, [totals]] = await Promise.all([
      db
        .select({
          spec: Specifications,
          groupName: SpecificationGroups.name,
        })
        .from(Specifications)
        .leftJoin(
          SpecificationGroups,
          eq(Specifications.groupUuid, SpecificationGroups.uuid),
        )
        .where(where)
        .orderBy(asc(Specifications.order))
        .limit(params.limit)
        .offset(params.offset),
      db.select({ total: count() }).from(Specifications).where(where),
    ]);

    const specs = specRows.map((row) => ({
      ...row.spec,
      groupName: row.groupName,
    }));

    // Only fetch category links for the specs on this page.
    const specUuids = specs.map((spec) => spec.uuid);
    const links =
      specUuids.length > 0
        ? await db
            .select({
              specificationUuid: SpecificationCategories.specificationUuid,
              categoryUuid: SpecificationCategories.categoryUuid,
              categoryName: Categories.name,
            })
            .from(SpecificationCategories)
            .leftJoin(
              Categories,
              eq(SpecificationCategories.categoryUuid, Categories.uuid),
            )
            .where(inArray(SpecificationCategories.specificationUuid, specUuids))
        : [];

    const items = specs.map((spec) => {
      const own = links.filter((link) => link.specificationUuid === spec.uuid);
      return {
        ...spec,
        categoryUuids: own.map((link) => link.categoryUuid),
        categoryNames: own.map((link) => link.categoryName ?? ""),
      };
    });

    return { items, total: Number(totals?.total ?? 0) };
  } catch (error) {
    console.error("getSpecificationsList failed:", error);
    throw new Error("Failed to fetch specifications", { cause: error });
  }
};

/** One specification with its assigned category uuids, for the edit form. */
export const getSpecification = async (
  uuid: string,
): Promise<SpecificationWithCategories | null> => {
  try {
    const [row] = await db
      .select({
        spec: Specifications,
        groupName: SpecificationGroups.name,
      })
      .from(Specifications)
      .leftJoin(
        SpecificationGroups,
        eq(Specifications.groupUuid, SpecificationGroups.uuid),
      )
      .where(eq(Specifications.uuid, uuid));
    if (!row) {
      return null;
    }
    const spec = { ...row.spec, groupName: row.groupName };

    const links = await db
      .select({
        categoryUuid: SpecificationCategories.categoryUuid,
        categoryName: Categories.name,
      })
      .from(SpecificationCategories)
      .leftJoin(
        Categories,
        eq(SpecificationCategories.categoryUuid, Categories.uuid),
      )
      .where(eq(SpecificationCategories.specificationUuid, uuid));

    return {
      ...spec,
      categoryUuids: links.map((link) => link.categoryUuid),
      categoryNames: links.map((link) => link.categoryName ?? ""),
    };
  } catch (error) {
    console.error("getSpecification failed:", error);
    throw new Error("Failed to fetch specification", { cause: error });
  }
};

// The transaction handle drizzle passes to a db.transaction callback.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Insert category links for a specification (no delete — caller decides).
// Runs on the given transaction so it's part of the caller's atomic write.
const insertSpecificationCategories = async (
  tx: Tx,
  specificationUuid: string,
  categoryUuids: string[],
): Promise<void> => {
  const unique = [...new Set(categoryUuids.filter((uuid) => uuid.length > 0))];
  if (unique.length > 0) {
    await tx.insert(SpecificationCategories).values(
      unique.map((categoryUuid) => ({
        uuid: randomUUID(),
        specificationUuid,
        categoryUuid,
      })),
    );
  }
};

export const createSpecification = async (
  fields: SpecificationFields,
  categoryUuids: string[],
): Promise<string> => {
  const uuid = randomUUID();
  // Spec row + its category links in one atomic write.
  await db.transaction(async (tx) => {
    const [{ total }] = await tx.select({ total: count() }).from(Specifications);
    await tx.insert(Specifications).values({ ...fields, uuid, order: total });
    await insertSpecificationCategories(tx, uuid, categoryUuids);
  });
  return uuid;
};

export const updateSpecification = async (
  uuid: string,
  fields: SpecificationFields,
  categoryUuids: string[],
): Promise<void> => {
  // Update the spec, clear its old links, and write the new ones as one atomic
  // write — a failure can't leave the spec updated but its links half-replaced.
  await db.transaction(async (tx) => {
    await tx.update(Specifications).set(fields).where(eq(Specifications.uuid, uuid));
    await tx
      .delete(SpecificationCategories)
      .where(eq(SpecificationCategories.specificationUuid, uuid));
    await insertSpecificationCategories(tx, uuid, categoryUuids);
  });
};

export const deleteSpecification = async (uuid: string): Promise<void> => {
  await db.delete(Specifications).where(eq(Specifications.uuid, uuid));
};

// The category itself plus every ancestor, walking up the parent chain. A
// specification assigned to any of these applies to the given category.
const getCategoryAndAncestors = async (
  categoryUuid: string,
): Promise<string[]> => {
  const all = await db
    .select({ uuid: Categories.uuid, parentUuid: Categories.parentUuid })
    .from(Categories);
  const parentOf = new Map(all.map((row) => [row.uuid, row.parentUuid]));

  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | null = categoryUuid;
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = parentOf.get(current) ?? null;
  }
  return chain;
};

/**
 * The resolved spec template for a category: every specification assigned to it
 * or any of its ancestors, as SpecField[] (the shape products fill).
 */
export const getSpecificationsForCategory = async (
  categoryUuid: string,
): Promise<SpecField[]> => {
  try {
    const categoryUuids = await getCategoryAndAncestors(categoryUuid);
    if (categoryUuids.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        uuid: Specifications.uuid,
        key: Specifications.key,
        label: Specifications.label,
        valueType: Specifications.valueType,
        unit: Specifications.unit,
        allowMultiple: Specifications.allowMultiple,
        allowRange: Specifications.allowRange,
        options: Specifications.options,
        order: Specifications.order,
      })
      .from(Specifications)
      .innerJoin(
        SpecificationCategories,
        eq(SpecificationCategories.specificationUuid, Specifications.uuid),
      )
      .where(inArray(SpecificationCategories.categoryUuid, categoryUuids))
      .orderBy(asc(Specifications.order));

    // A spec linked to several ancestors shows up multiple times — dedupe.
    const seen = new Set<string>();
    const specs: SpecField[] = [];
    for (const row of rows) {
      if (seen.has(row.uuid)) {
        continue;
      }
      seen.add(row.uuid);
      specs.push({
        key: row.key,
        label: row.label,
        options: row.options ?? [],
        valueType: row.valueType,
        unit: row.unit,
        allowMultiple: row.allowMultiple,
        allowRange: row.allowRange,
      });
    }
    return specs;
  } catch (error) {
    console.error("getSpecificationsForCategory failed:", error);
    throw new Error("Failed to fetch specifications for category", {
      cause: error,
    });
  }
};
