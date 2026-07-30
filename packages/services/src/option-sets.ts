import { asc, eq, sql } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import { Products } from "../../../db/schema/products";
import {
  SelectSpecificationOptionSets,
  SpecificationOptionSets,
} from "../../../db/schema/specification-option-sets";
import { Specifications } from "../../../db/schema/specifications";
import type { ProductValue, SpecOption } from "../../../db/types";
import { recordAudit } from "./catalog-audit";
import { invalidateCatalogModel } from "./catalog-model";
import { ValidationError } from "./errors";
import { mergeOptions, type LibraryOptionInput } from "./library-options";

// ---------------------------------------------------------------------------
// SHARED VOCABULARIES — the option lists more than one attribute spells the same
// way.
//
// The problem this solves, concretely: a switch declares its cages as rows of
// {count, family, max speed}, and a transceiver declares its own speed. Until
// both could name ONE speed list, "1G" on the switch and "1G" on the module were
// unrelated strings, and the rule everyone actually wants — a module fits a cage
// when the cage's speed is at least the module's — had nothing to compare.
//
// A set is a dictionary and nothing more. It has no type, no unit, no condition
// and no rule, so an attribute pointing at one is still a self-contained
// definition: the boundary rule holds exactly as written.
//
// The single thing this service protects: a value already stored NEVER changes
// meaning. That is why options are append-only here as everywhere else, why a set
// in use cannot be deleted, and why re-pointing an attribute at a different
// vocabulary is refused once products hold values.
// ---------------------------------------------------------------------------

export type OptionSetInput = {
  name: string;
  description: string | null;
  ordered: boolean;
  options: LibraryOptionInput[];
};

export type OptionSet = {
  uuid: string;
  name: string;
  description: SelectSpecificationOptionSets["description"];
  ordered: boolean;
  options: SpecOption[];
  // What points at it. Drives the "in use by" line and the delete guard's
  // message — an author needs to know a rename here is felt in four places.
  attributeLabels: string[];
  // Attributes whose GROUP sub-fields point at it, which is the case the plain
  // column lookup cannot see (the pointer lives inside the JSON schema).
  groupFieldLabels: string[];
};

/**
 * Every set, with the live option list and what uses it. TWO queries regardless
 * of how many sets or attributes exist.
 */
export const getOptionSets = async (): Promise<OptionSet[]> => {
  const [sets, specs] = await Promise.all([
    db
      .select()
      .from(SpecificationOptionSets)
      .orderBy(asc(SpecificationOptionSets.name)),
    db
      .select({
        label: Specifications.label,
        optionSetUuid: Specifications.optionSetUuid,
        groupFields: Specifications.groupFields,
      })
      .from(Specifications),
  ]);

  const direct = new Map<string, string[]>();
  const viaGroup = new Map<string, string[]>();
  const push = (
    into: Map<string, string[]>,
    uuid: string,
    label: string,
  ): void => {
    const list = into.get(uuid) ?? [];
    // A group can point two sub-fields at one set (an "in" speed and an "out"
    // speed). That is one attribute to name, not two.
    if (!list.includes(label)) {
      list.push(label);
      into.set(uuid, list);
    }
  };

  for (const spec of specs) {
    if (spec.optionSetUuid) {
      push(direct, spec.optionSetUuid, spec.label);
    }
    for (const field of spec.groupFields ?? []) {
      if (field.optionSetUuid) {
        push(viaGroup, field.optionSetUuid, `${spec.label} · ${field.label}`);
      }
    }
  }

  return sets.map((set) => ({
    uuid: set.uuid,
    name: set.name,
    description: set.description,
    ordered: set.ordered,
    options: set.options ?? [],
    attributeLabels: direct.get(set.uuid) ?? [],
    groupFieldLabels: viaGroup.get(set.uuid) ?? [],
  }));
};

const assertValidInput = (input: OptionSetInput): void => {
  if (input.name.trim() === "") {
    throw new ValidationError("A shared list needs a name.");
  }
  const named = input.options.filter((option) => option.label.trim() !== "");
  if (named.length === 0) {
    throw new ValidationError(
      `"${input.name}" needs at least one option — an empty shared list leaves every attribute using it with nothing to offer.`,
    );
  }
};

export const createOptionSet = async (
  input: OptionSetInput,
  actor?: { uuid: string; name: string },
): Promise<string> => {
  assertValidInput(input);
  const uuid = generateUuid();

  await db.insert(SpecificationOptionSets).values({
    uuid,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    ordered: input.ordered,
    options: mergeOptions([], input.options, input.ordered),
  });

  // Filed under `specification` rather than a target of its own: widening that
  // enum means an ALTER on a populated table for no gain, and the label prefix
  // already tells a reader of the trail what they are looking at.
  await recordAudit({
    target: "specification",
    action: "create",
    targetUuid: uuid,
    targetLabel: `Shared list: ${input.name}`,
    actor,
  });
  invalidateCatalogModel();
  return uuid;
};

/**
 * Update a set. Options go through the same append-only merge as an attribute's
 * own list, so an option that disappears from the input is RETIRED rather than
 * removed — and here that matters more than usual, because products across
 * several different attributes may be holding it.
 *
 * `ordered` may be turned on freely (nothing was comparable before, and now it
 * is) but turning it OFF while an ordered comparison exists would make that
 * comparison silently stop matching. That is a relationship-level concern and the
 * rule editor is what owns it; what this refuses is only the change that
 * reinterprets stored VALUES.
 */
export const updateOptionSet = async (
  uuid: string,
  input: OptionSetInput,
  actor?: { uuid: string; name: string },
): Promise<void> => {
  assertValidInput(input);

  const [current] = await db
    .select()
    .from(SpecificationOptionSets)
    .where(eq(SpecificationOptionSets.uuid, uuid));
  if (!current) {
    throw new ValidationError("That shared list no longer exists.");
  }

  await db
    .update(SpecificationOptionSets)
    .set({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      ordered: input.ordered,
      options: mergeOptions(
        current.options ?? [],
        input.options,
        input.ordered,
      ),
    })
    .where(eq(SpecificationOptionSets.uuid, uuid));

  await recordAudit({
    target: "specification",
    action: "update",
    targetUuid: uuid,
    targetLabel: `Shared list: ${input.name}`,
    actor,
  });
  invalidateCatalogModel();
};

/**
 * Delete a set — REFUSED while any attribute or group sub-field points at it.
 *
 * The foreign key already refuses the direct case, but a sub-field's pointer
 * lives inside a JSON column where no constraint can see it. So the check is done
 * here for both, in one place, with a message that names what is in the way —
 * otherwise deleting a set would leave a group's picks resolving to an empty list
 * and every stored row in it unreadable.
 */
export const deleteOptionSet = async (
  uuid: string,
  actor?: { uuid: string; name: string },
): Promise<void> => {
  const [current] = await db
    .select({ name: SpecificationOptionSets.name })
    .from(SpecificationOptionSets)
    .where(eq(SpecificationOptionSets.uuid, uuid));
  if (!current) {
    return;
  }

  const users = await optionSetUsers(uuid);
  if (users.length > 0) {
    throw new ValidationError(
      `"${current.name}" cannot be deleted: ${users.length} attribute(s) use it — ${users.slice(0, 3).join(", ")}. Point those at another list first.`,
    );
  }

  await db
    .delete(SpecificationOptionSets)
    .where(eq(SpecificationOptionSets.uuid, uuid));
  await recordAudit({
    target: "specification",
    action: "delete",
    targetUuid: uuid,
    targetLabel: `Shared list: ${current.name}`,
    actor,
  });
  invalidateCatalogModel();
};

/** Everything pointing at a set, named for a human — both routes, one list. */
export const optionSetUsers = async (uuid: string): Promise<string[]> => {
  const specs = await db
    .select({
      label: Specifications.label,
      optionSetUuid: Specifications.optionSetUuid,
      groupFields: Specifications.groupFields,
    })
    .from(Specifications);

  const found: string[] = [];
  for (const spec of specs) {
    if (spec.optionSetUuid === uuid) {
      found.push(spec.label);
      continue;
    }
    const field = (spec.groupFields ?? []).find(
      (entry) => entry.optionSetUuid === uuid,
    );
    if (field) {
      found.push(`${spec.label} · ${field.label}`);
    }
  }
  return found;
};

export type HeldValues = {
  // Named, so a refusal can say WHICH products are in the way.
  productNames: string[];
  // One entry per product holding the attribute, in whatever shape it stored.
  values: ProductValue[];
};

/**
 * What products are currently holding for one attribute.
 *
 * This is what makes re-pointing an option source answerable rather than simply
 * forbidden. Re-pointing touches no stored value — it changes what those values
 * MEAN, all at once and with nothing to look at afterwards. So the check is
 * whether the destination vocabulary spells every value already held (see
 * `usedOptionValues` / `valuesOutsideVocabulary`), and that needs the values
 * themselves, not a count.
 *
 * ONE query, and only the products that actually hold the attribute: the uuid is
 * matched as a JSON path in the WHERE clause rather than by loading the catalog
 * and filtering in memory. The path is bound as a parameter, never interpolated.
 * It runs only when an author changes an option source, which is rare — so
 * reading whole value maps for those few rows is the right trade against the
 * per-row extraction that would return JSON as an untyped string.
 */
export const readHeldValues = async (
  specificationUuid: string,
): Promise<HeldValues> => {
  const path = `$.${JSON.stringify(specificationUuid)}`;
  const rows = await db
    .select({ name: Products.name, specValues: Products.specValues })
    .from(Products)
    .where(sql`json_contains_path(${Products.specValues}, 'one', ${path})`);

  return {
    productNames: rows.map((row) => row.name),
    values: rows.flatMap((row) => {
      const value = row.specValues?.[specificationUuid];
      return value === undefined ? [] : [value];
    }),
  };
};
