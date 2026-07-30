import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../db";
import { SpecificationCategories } from "../../../db/schema/specification-categories";
import { SpecificationOptionSets } from "../../../db/schema/specification-option-sets";
import { Specifications } from "../../../db/schema/specifications";
import type { SpecGroupField, SpecOption } from "../../../db/types";
import { recordAudit } from "./catalog-audit";
import { getCatalogModel, invalidateCatalogModel } from "./catalog-model";
import { ValidationError } from "./errors";
import { mergeOptions, similarOptions } from "./library-options";
import { optionSetUsers } from "./option-sets";

// ---------------------------------------------------------------------------
// ADDING ONE OPTION, from wherever the author noticed it was missing.
//
// The gap this closes is not convenience. An author filling in a product finds
// the list has no "802.3at", and the only route to add one is to leave the
// half-entered form, find the attribute in the Library, and come back. What
// happens instead is that they pick the closest thing, or type a near-duplicate
// the next time round — and both of those are silent. A rule keyed on "802.3at"
// simply stops matching, which is indistinguishable from a rule nothing violated.
//
// So this is deliberately not a general option editor. It appends ONE value, and
// everything it does beyond that is about making the consequences visible before
// they are invisible:
//
//   - a near-duplicate is surfaced, with the existing option named, so the author
//     can pick that one instead (see `similarOptions` — value collisions were
//     always handled, semantic ones never were)
//   - a SHARED list says who else it changes, because adding there is not a local
//     edit
//   - a narrowed category slice is WIDENED to include the new value, or the
//     author would add a value and watch the form not offer it
// ---------------------------------------------------------------------------

export type AddOptionRequest = {
  specificationUuid: string;
  label: string;
  // Only meaningful on a `group`: which column of the rows the option belongs to.
  groupFieldKey?: string;
  // The category whose form the author is on. The slice is widened for THIS
  // category only — quietly widening every category that narrowed the attribute
  // would be an edit nobody asked for on screens nobody was looking at.
  categoryUuid?: string;
  // On an ordered scale a rank decides where the value sits, and the comparators
  // are meaningless without one. Omitted, it lands at the end.
  rank?: number | null;
  // Set once the author has seen the near-duplicates and chosen to go ahead.
  // Without it, a near-duplicate is REPORTED and nothing is written.
  confirmed?: boolean;
};

export type AddOptionResult =
  | {
      status: "added";
      option: SpecOption;
      // Said out loud when it is true, because the author's mental model is "I am
      // adding a value to this product's dropdown".
      sharedWith: string[];
      // Set when the category offered a narrowed slice and it was widened so the
      // new value actually appears.
      widenedSlice: boolean;
    }
  | {
      status: "similar";
      // What it might be a second name for. Nothing is written.
      similar: SpecOption[];
    };

type Target = {
  ordered: boolean;
  options: SpecOption[];
  // How the option is written back — an attribute's own list, a shared set, or
  // one column of a group.
  write: (next: SpecOption[]) => Promise<void>;
  sharedWith: string[];
  label: string;
};

/**
 * Where the option actually belongs.
 *
 * Four destinations look the same to an author and are completely different
 * writes: the attribute's own list, the shared set it borrows, a group column's
 * own list, and the shared set THAT borrows. Resolving it in one place is what
 * stops an option being appended to a list nothing reads — which would look like
 * a successful add and change nothing.
 */
const resolveTarget = async (
  request: AddOptionRequest,
): Promise<Target> => {
  const [spec] = await db
    .select()
    .from(Specifications)
    .where(eq(Specifications.uuid, request.specificationUuid));
  if (!spec) {
    throw new ValidationError("That attribute no longer exists.");
  }

  const setTarget = async (
    setUuid: string,
    describe: string,
  ): Promise<Target> => {
    const [set] = await db
      .select()
      .from(SpecificationOptionSets)
      .where(eq(SpecificationOptionSets.uuid, setUuid));
    if (!set) {
      throw new ValidationError(
        `"${describe}" points at a shared list that no longer exists. Fix that in the Library first.`,
      );
    }
    const users = await optionSetUsers(setUuid);
    return {
      ordered: set.ordered,
      options: set.options ?? [],
      write: async (next) => {
        await db
          .update(SpecificationOptionSets)
          .set({ options: next })
          .where(eq(SpecificationOptionSets.uuid, setUuid));
      },
      // Everything pointing at the set EXCEPT the attribute being edited: telling
      // an author their edit affects the thing they are editing is noise, and it
      // buries the names that matter.
      sharedWith: users.filter((user) => !user.startsWith(spec.label)),
      label: set.name,
    };
  };

  if (request.groupFieldKey) {
    if (spec.type !== "group") {
      throw new ValidationError(
        `"${spec.label}" does not hold rows, so it has no columns to add a value to.`,
      );
    }
    const fields = spec.groupFields ?? [];
    const field = fields.find((entry) => entry.key === request.groupFieldKey);
    if (!field) {
      throw new ValidationError(
        `"${spec.label}" no longer has that column. Reopen the form to see the current ones.`,
      );
    }
    if (field.kind !== "select") {
      throw new ValidationError(
        `"${field.label}" holds a number, so there is no list of values to add to.`,
      );
    }
    if (field.optionSetUuid) {
      return setTarget(field.optionSetUuid, `${spec.label} · ${field.label}`);
    }
    return {
      ordered: field.ordered,
      options: field.options,
      write: async (next) => {
        const updated: SpecGroupField[] = fields.map((entry) =>
          entry.key === field.key ? { ...entry, options: next } : entry,
        );
        await db
          .update(Specifications)
          .set({ groupFields: updated })
          .where(eq(Specifications.uuid, spec.uuid));
      },
      sharedWith: [],
      label: `${spec.label} · ${field.label}`,
    };
  }

  if (spec.type !== "single_select" && spec.type !== "multi_select") {
    throw new ValidationError(
      `"${spec.label}" is not a list of values, so there is nothing to add to it.`,
    );
  }
  if (spec.optionSetUuid) {
    return setTarget(spec.optionSetUuid, spec.label);
  }
  return {
    ordered: spec.ordered,
    options: spec.options ?? [],
    write: async (next) => {
      await db
        .update(Specifications)
        .set({ options: next })
        .where(eq(Specifications.uuid, spec.uuid));
    },
    sharedWith: [],
    label: spec.label,
  };
};

/**
 * Widen this category's slice so a value it just gained is actually offered.
 *
 * Without this the feature is a trap. A category that narrowed the attribute to
 * three of its values does not offer a fourth just because the library gained one
 * — so the author adds "802.3bt", the dropdown does not show it, and the obvious
 * conclusion is that the add failed. They add it again.
 *
 * Only rows that ALREADY narrow are touched (a null slice means "offer
 * everything" and needs nothing), and only for the one category whose form the
 * author is on.
 */
const widenSlice = async (
  specificationUuid: string,
  categoryUuid: string,
  value: string,
): Promise<boolean> => {
  const model = await getCatalogModel();
  // The chain, so widening works from a form driven by an INHERITED assignment:
  // the row that needs the value is the ancestor's, and narrowing this category
  // instead would silently stop it inheriting anything else.
  const chain = model.chains.get(categoryUuid) ?? [categoryUuid];
  const rows = await db
    .select({
      categoryUuid: SpecificationCategories.categoryUuid,
      enabledValues: SpecificationCategories.enabledValues,
    })
    .from(SpecificationCategories)
    .where(
      and(
        eq(SpecificationCategories.specificationUuid, specificationUuid),
        inArray(SpecificationCategories.categoryUuid, chain),
      ),
    );

  const narrowed = rows.filter(
    (row) => row.enabledValues !== null && row.enabledValues.length > 0,
  );
  if (narrowed.length === 0) {
    return false;
  }

  // The NEAREST narrowing row only. That is the one whose slice the form is
  // reading — `resolveAssignments` takes the nearest row in the chain — so
  // widening an ancestor as well would change categories the author never opened.
  const nearest = narrowed.sort(
    (a, b) => chain.indexOf(a.categoryUuid) - chain.indexOf(b.categoryUuid),
  )[0];
  if (!nearest || nearest.enabledValues?.includes(value)) {
    return false;
  }

  await db
    .update(SpecificationCategories)
    .set({ enabledValues: [...(nearest.enabledValues ?? []), value] })
    .where(
      and(
        eq(SpecificationCategories.specificationUuid, specificationUuid),
        eq(SpecificationCategories.categoryUuid, nearest.categoryUuid),
      ),
    );
  return true;
};

/**
 * Append one option, or report what it might be a duplicate of.
 *
 * Two-step on purpose. A near-duplicate is not an error — "10G" and "10 Gbps" may
 * genuinely both be wanted — so this never refuses outright; it hands back what it
 * found and waits for `confirmed`. What it will not do is write silently, because
 * the whole failure being prevented here is a second spelling nobody noticed.
 */
export const addAttributeOption = async (
  request: AddOptionRequest,
  actor?: { uuid: string; name: string },
): Promise<AddOptionResult> => {
  const label = request.label.trim();
  if (label === "") {
    throw new ValidationError("A value needs a name.");
  }

  const target = await resolveTarget(request);

  // An EXACT match is not a duplicate to warn about — it is the option the author
  // was looking for and could not find. Handing it back as "added" is the honest
  // answer: the form selects it, and nothing was written.
  const exact = target.options.find(
    (option) =>
      option.label.trim().toLowerCase() === label.toLowerCase() &&
      !option.retired,
  );
  if (exact) {
    return {
      status: "added",
      option: exact,
      sharedWith: [],
      widenedSlice: request.categoryUuid
        ? await widenSlice(
            request.specificationUuid,
            request.categoryUuid,
            exact.value,
          )
        : false,
    };
  }

  if (!request.confirmed) {
    const similar = similarOptions(label, target.options);
    if (similar.length > 0) {
      return { status: "similar", similar };
    }
  }

  // Through `mergeOptions` rather than pushing an object: it owns value identity,
  // including the two-pass claim that stops a new label stealing the derived value
  // an existing option's products already point at.
  const next = mergeOptions(
    target.options,
    [
      // Existing options are passed back with their values so nothing is
      // re-derived and nothing is retired by omission.
      ...target.options.map((option) => ({
        value: option.value,
        label: option.label,
        rank: option.rank,
      })),
      { label, rank: request.rank ?? null },
    ],
    target.ordered,
  );

  // Whatever `mergeOptions` decided this option's identity is — never a value
  // guessed here, or the form would select something that does not exist.
  const known = new Set(target.options.map((option) => option.value));
  const added = next.find((option) => !known.has(option.value));
  if (!added) {
    throw new ValidationError(
      "That value could not be added. Reopen the form and try again.",
    );
  }

  // A retired option coming back keeps its identity, so the list can shrink here
  // rather than grow. `mergeOptions` handles it; the un-retiring is why the guard
  // above looks for a NEW value rather than a longer list.
  await target.write(next);

  const widenedSlice = request.categoryUuid
    ? await widenSlice(
        request.specificationUuid,
        request.categoryUuid,
        added.value,
      )
    : false;

  await recordAudit({
    target: "specification",
    action: "update",
    targetUuid: request.specificationUuid,
    targetLabel: target.label,
    actor,
    changes: [{ field: "options", from: null, to: `added "${label}"` }],
  });
  invalidateCatalogModel();

  return {
    status: "added",
    option: added,
    sharedWith: target.sharedWith,
    widenedSlice,
  };
};
