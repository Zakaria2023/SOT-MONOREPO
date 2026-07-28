import { and, eq, inArray, sql } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import type { AssignmentAudience, AssignmentScope } from "../../../db/enum";
import { Categories } from "../../../db/schema/categories";
import { SpecificationCategories } from "../../../db/schema/specification-categories";
import { predicateAttributes, type Predicate } from "../../../db/types";
import {
  resolveAssignments,
  revealProblems,
  type ResolvedAssignment,
} from "./assignment-resolver";
import { recordAudit, recordAuditBatch } from "./catalog-audit";
import {
  getCatalogModel,
  invalidateCatalogModel,
  resolveCategoryAssignments,
  resolveFromModel,
} from "./catalog-model";
import { ValidationError } from "./errors";
import { validatePredicate } from "./predicate";

// ---------------------------------------------------------------------------
// THE ASSIGNMENT SERVICE — the ONLY writer of category ↔ attribute links.
//
// One writer is a hard rule, not a convention. When the library screen could
// also create and remove these rows, editing an attribute's name silently reset
// how every category used it: two screens disagreed about what a link meant, and
// the last one to save won.
// ---------------------------------------------------------------------------

export type AssignmentInput = {
  categoryUuid: string;
  specificationUuid: string;
  isFilter: boolean;
  isRule: boolean;
  scope: AssignmentScope;
  showIf: Predicate | null;
  audience: AssignmentAudience;
  enabledValues: string[] | null;
  suppressed: boolean;
  order: number;
};

export type SaveAssignmentsOptions = {
  actor?: { uuid: string; name: string };
  // The caller has just created the attribute, so no link to it can exist yet.
  // A promise, not a hint: the unique constraint on (category, specification)
  // turns a wrong one into a loud failure rather than a duplicate row.
  noneExistYet?: boolean;
};

export type CategoryAssignments = {
  categoryUuid: string;
  categoryName: string;
  resolved: ResolvedAssignment[];
  // Attributes authored on this very category, as opposed to inherited. The
  // admin needs the distinction to know what it may edit here.
  ownUuids: string[];
  problems: ReturnType<typeof revealProblems>;
};

/**
 * Everything a category carries, plus what is wrong with its reveal graph.
 *
 * The problems are returned alongside rather than thrown: an author needs to SEE
 * a broken reveal in order to fix it, and refusing to load the page would hide
 * the very thing they came to repair.
 */
export const getCategoryAssignments = async (
  categoryUuid: string,
): Promise<CategoryAssignments> => {
  const [category] = await db
    .select({ uuid: Categories.uuid, name: Categories.name })
    .from(Categories)
    .where(eq(Categories.uuid, categoryUuid));
  if (!category) {
    throw new ValidationError("That category no longer exists.");
  }

  const resolved = await resolveCategoryAssignments(categoryUuid);
  return {
    categoryUuid,
    categoryName: category.name,
    resolved,
    ownUuids: resolved
      .filter((assignment) => !assignment.inherited)
      .map((assignment) => assignment.definition.uuid),
    problems: revealProblems(resolved),
  };
};

/**
 * Validate an assignment before it is written.
 *
 * Three failures, all of which would otherwise be invisible until someone
 * noticed a field that never appears:
 *
 *  - the reveal references an attribute that does not exist;
 *  - the reveal names a trigger this category does not carry, so the field can
 *    never show;
 *  - the reveal closes a cycle with another attribute, so neither can show and
 *    which one wins depends on evaluation order.
 */
const assertAssignmentValid = (
  input: AssignmentInput,
  model: Awaited<ReturnType<typeof getCatalogModel>>,
): void => {
  if (input.showIf) {
    const problems = validatePredicate(input.showIf, model.attributes);
    const first = problems[0];
    if (first) {
      throw new ValidationError(first.message);
    }
  }

  // Resolve the category AS IF this assignment were already saved, so the checks
  // see the graph the author is actually creating.
  const chain = model.chains.get(input.categoryUuid) ?? [input.categoryUuid];
  const rows = [
    ...model.assignments.filter(
      (row) =>
        !(
          row.categoryUuid === input.categoryUuid &&
          row.specificationUuid === input.specificationUuid
        ),
    ),
    input,
  ];
  const resolved = resolveAssignments({
    chain,
    rows,
    definitions: model.definitions,
  });

  const problem = revealProblems(resolved).find(
    (entry) => entry.specificationUuid === input.specificationUuid,
  );
  if (problem) {
    throw new ValidationError(problem.message);
  }
};

/** Create or update one assignment. Upsert, because the pair is unique. */
export const saveAssignment = async (
  input: AssignmentInput,
  actor?: { uuid: string; name: string },
): Promise<void> => {
  assertAssignmentValid(input, await getCatalogModel());

  const [existing] = await db
    .select({ uuid: SpecificationCategories.uuid })
    .from(SpecificationCategories)
    .where(
      and(
        eq(SpecificationCategories.categoryUuid, input.categoryUuid),
        eq(SpecificationCategories.specificationUuid, input.specificationUuid),
      ),
    );

  const values = {
    isFilter: input.isFilter,
    isRule: input.isRule,
    scope: input.scope,
    showIf: input.showIf,
    audience: input.audience,
    enabledValues:
      input.enabledValues && input.enabledValues.length > 0
        ? input.enabledValues
        : null,
    suppressed: input.suppressed,
    order: input.order,
  };

  if (existing) {
    await db
      .update(SpecificationCategories)
      .set(values)
      .where(eq(SpecificationCategories.uuid, existing.uuid));
  } else {
    await db.insert(SpecificationCategories).values({
      uuid: generateUuid(),
      categoryUuid: input.categoryUuid,
      specificationUuid: input.specificationUuid,
      ...values,
    });
  }

  await recordAudit({
    target: "assignment",
    action: existing ? "update" : "create",
    targetUuid: `${input.categoryUuid}:${input.specificationUuid}`,
    targetLabel: await describeAssignment(input),
    actor,
  });
  invalidateCatalogModel();
};

/**
 * Save MANY assignments as one operation.
 *
 * The library form links a new attribute to every category that uses it, and
 * doing that as a loop of `saveAssignment` was costing a full catalog-model
 * reload PER CATEGORY: each save invalidates the cache on its way out, so the
 * next one rebuilds all five queries just to validate. Four categories measured
 * at roughly a minute against the remote database — long enough that the form
 * looks hung rather than slow.
 *
 * So: load the model ONCE, validate every row against it, write in two
 * statements, audit in one, and invalidate at the very end. Independent
 * categories cannot affect each other's validation, which is what makes one
 * shared model correct here and not merely faster.
 */
export const saveAssignments = async (
  inputs: AssignmentInput[],
  options: SaveAssignmentsOptions = {},
): Promise<void> => {
  if (inputs.length === 0) {
    return;
  }
  const { actor, noneExistYet = false } = options;

  const model = await getCatalogModel();
  for (const input of inputs) {
    assertAssignmentValid(input, model);
  }

  // Which of these pairs already exist — one query for all of them, never one
  // per row. Skipped entirely when the caller has just created the attribute:
  // nothing can be linked to something that did not exist a moment ago, and on
  // a link this slow a pointless round trip is a second of somebody's time.
  const existingByPair = new Map<string, string>();
  if (!noneExistYet) {
    const existing = await db
      .select({
        uuid: SpecificationCategories.uuid,
        categoryUuid: SpecificationCategories.categoryUuid,
        specificationUuid: SpecificationCategories.specificationUuid,
      })
      .from(SpecificationCategories)
      .where(
        and(
          inArray(SpecificationCategories.specificationUuid, [
            ...new Set(inputs.map((input) => input.specificationUuid)),
          ]),
          inArray(SpecificationCategories.categoryUuid, [
            ...new Set(inputs.map((input) => input.categoryUuid)),
          ]),
        ),
      );
    for (const row of existing) {
      existingByPair.set(
        `${row.categoryUuid}:${row.specificationUuid}`,
        row.uuid,
      );
    }
  }

  const toValues = (input: AssignmentInput) => ({
    isFilter: input.isFilter,
    isRule: input.isRule,
    scope: input.scope,
    showIf: input.showIf,
    audience: input.audience,
    enabledValues:
      input.enabledValues && input.enabledValues.length > 0
        ? input.enabledValues
        : null,
    suppressed: input.suppressed,
    order: input.order,
  });

  // One statement covers both paths. The (specification_uuid, category_uuid)
  // unique key turns an already-linked pair into an update and a new pair into
  // an insert, so there is no need to split the two or to issue a statement per
  // row. Rows that already exist carry their own uuid in and the update branch
  // never writes it, so the identity of an existing assignment is preserved.
  //
  // The previous shape ran the updates concurrently, which is not the same as
  // batching them: the pool is deliberately capped at four connections, so a
  // wide save still queued in fours while occupying every connection the app
  // had. Linking one attribute across a few hundred categories was enough to
  // starve every other request for the duration.
  await db
    .insert(SpecificationCategories)
    .values(
      inputs.map((input) => ({
        uuid:
          existingByPair.get(
            `${input.categoryUuid}:${input.specificationUuid}`,
          ) ?? generateUuid(),
        categoryUuid: input.categoryUuid,
        specificationUuid: input.specificationUuid,
        ...toValues(input),
      })),
    )
    .onDuplicateKeyUpdate({
      set: {
        isFilter: sql`values(${SpecificationCategories.isFilter})`,
        isRule: sql`values(${SpecificationCategories.isRule})`,
        scope: sql`values(${SpecificationCategories.scope})`,
        showIf: sql`values(${SpecificationCategories.showIf})`,
        audience: sql`values(${SpecificationCategories.audience})`,
        enabledValues: sql`values(${SpecificationCategories.enabledValues})`,
        suppressed: sql`values(${SpecificationCategories.suppressed})`,
        order: sql`values(${SpecificationCategories.order})`,
      },
    });

  await recordAuditBatch(
    inputs.map((input) => ({
      target: "assignment" as const,
      action: existingByPair.has(
        `${input.categoryUuid}:${input.specificationUuid}`,
      )
        ? ("update" as const)
        : ("create" as const),
      targetUuid: `${input.categoryUuid}:${input.specificationUuid}`,
      // The label comes from the model already in hand — the per-row version
      // fetched it again for every single entry.
      targetLabel: `${
        model.attributes.get(input.specificationUuid)?.label ??
        input.specificationUuid
      } on ${input.categoryUuid}`,
      actor,
    })),
  );

  invalidateCatalogModel();
};

const describeAssignment = async (input: AssignmentInput): Promise<string> => {
  const model = await getCatalogModel();
  const label =
    model.attributes.get(input.specificationUuid)?.label ??
    input.specificationUuid;
  return `${label} on ${input.categoryUuid}`;
};

/**
 * Remove an assignment — REFUSED while another assignment on the same category
 * uses that attribute as its reveal trigger.
 *
 * Otherwise the dependent field is left watching something nobody can set, which
 * means it is permanently hidden and nothing says so.
 */
export const removeAssignment = async (
  categoryUuid: string,
  specificationUuid: string,
  actor?: { uuid: string; name: string },
): Promise<void> => {
  const resolved = await resolveCategoryAssignments(categoryUuid);

  const dependents = resolved.filter(
    (assignment) =>
      assignment.definition.uuid !== specificationUuid &&
      predicateAttributes(assignment.showIf).includes(specificationUuid),
  );
  if (dependents.length > 0) {
    const names = dependents
      .map((assignment) => assignment.definition.label)
      .join(", ");
    throw new ValidationError(
      `This attribute reveals ${names} on this category. Change ${dependents.length > 1 ? "those reveals" : "that reveal"} first, or ${names} would be permanently hidden.`,
    );
  }

  await db
    .delete(SpecificationCategories)
    .where(
      and(
        eq(SpecificationCategories.categoryUuid, categoryUuid),
        eq(SpecificationCategories.specificationUuid, specificationUuid),
      ),
    );

  await recordAudit({
    target: "assignment",
    action: "delete",
    targetUuid: `${categoryUuid}:${specificationUuid}`,
    targetLabel:
      resolved.find(
        (assignment) => assignment.definition.uuid === specificationUuid,
      )?.definition.label ?? specificationUuid,
    actor,
  });
  invalidateCatalogModel();
};

/**
 * Unlink one attribute from MANY categories at once.
 *
 * Same shape and the same reason as `saveAssignments`: one model load, one
 * delete, one audit batch, one invalidation — rather than all of that per
 * category. The reveal-dependency guard is unchanged and still runs per
 * category, because a dependent field on ONE of them has to stop the whole
 * operation with a message naming it.
 */
export const removeAssignments = async (
  specificationUuid: string,
  categoryUuids: string[],
  actor?: { uuid: string; name: string },
): Promise<void> => {
  if (categoryUuids.length === 0) {
    return;
  }

  // ONE attribute across MANY categories, deliberately — not arbitrary pairs.
  // A pair-shaped signature would have to be expressed as `categoryUuid IN (…)
  // AND specificationUuid IN (…)`, which is a cross product: unlinking (A, X)
  // and (B, Y) would also delete (A, Y) and (B, X). This shape cannot say that.
  const model = await getCatalogModel();
  let label = specificationUuid;

  for (const categoryUuid of categoryUuids) {
    const resolved = resolveFromModel(model, categoryUuid);
    const dependents = resolved.filter(
      (assignment) =>
        assignment.definition.uuid !== specificationUuid &&
        predicateAttributes(assignment.showIf).includes(specificationUuid),
    );
    if (dependents.length > 0) {
      const names = dependents
        .map((assignment) => assignment.definition.label)
        .join(", ");
      throw new ValidationError(
        `This attribute reveals ${names} on one of those categories. Change ${dependents.length > 1 ? "those reveals" : "that reveal"} first, or ${names} would be permanently hidden.`,
      );
    }
    label =
      resolved.find(
        (assignment) => assignment.definition.uuid === specificationUuid,
      )?.definition.label ?? label;
  }

  await db
    .delete(SpecificationCategories)
    .where(
      and(
        eq(SpecificationCategories.specificationUuid, specificationUuid),
        inArray(SpecificationCategories.categoryUuid, categoryUuids),
      ),
    );

  await recordAuditBatch(
    categoryUuids.map((categoryUuid) => ({
      target: "assignment" as const,
      action: "delete" as const,
      targetUuid: `${categoryUuid}:${specificationUuid}`,
      targetLabel: label,
      actor,
    })),
  );
  invalidateCatalogModel();
};

/**
 * Suppress an inherited attribute on this category.
 *
 * Stored as its own row with `suppressed` on, because there is nothing else to
 * delete — the assignment lives on an ancestor. This is why suppression has to
 * exist: without it, dropping an inherited attribute from one leaf would mean
 * removing it from the ancestor and re-adding it to every sibling.
 */
export const suppressInherited = async (
  categoryUuid: string,
  specificationUuid: string,
  actor?: { uuid: string; name: string },
): Promise<void> => {
  await saveAssignment(
    {
      categoryUuid,
      specificationUuid,
      isFilter: false,
      isRule: false,
      scope: "leaf",
      showIf: null,
      audience: "everyone",
      enabledValues: null,
      suppressed: true,
      order: 0,
    },
    actor,
  );
};

export const reorderAssignments = async (
  categoryUuid: string,
  order: { specificationUuid: string; order: number }[],
): Promise<void> => {
  await Promise.all(
    order.map((entry) =>
      db
        .update(SpecificationCategories)
        .set({ order: entry.order })
        .where(
          and(
            eq(SpecificationCategories.categoryUuid, categoryUuid),
            eq(
              SpecificationCategories.specificationUuid,
              entry.specificationUuid,
            ),
          ),
        ),
    ),
  );
  invalidateCatalogModel();
};
