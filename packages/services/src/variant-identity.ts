// ---------------------------------------------------------------------------
// Variant identity. Pure — no database, so it is testable on its own.
//
// It lives apart from `variants` for the same reason option identity lives apart
// from the library service: that module opens a connection the moment it is
// imported, and this is the piece of it that decides whether two rows are the
// same product. A mistake here is not a display bug — it is two distinct
// products silently becoming one, or one becoming two.
// ---------------------------------------------------------------------------

/**
 * The identity signature for a set of variants: sorted slugs, joined.
 *
 * A product IS brand + model + its set of variants, and a unique index cannot
 * span a JSON array — so the set is flattened to one comparable string and the
 * constraint binds on that. Everything about this function is in service of the
 * flattening being total.
 *
 * SORTED, so the same set always produces the same signature. Without it,
 * whether a duplicate is caught would depend on the order an author happened to
 * tick two checkboxes in, which is not a property anybody could reason about.
 *
 * DE-DUPLICATED, because a variant ticked twice is a variant ticked once, and
 * two signatures for that would be two identities for one product.
 *
 * EMPTY GIVES NULL, not "". MySQL treats NULLs in a unique index as distinct,
 * and that is exactly what is wanted here: a catalogue full of products with no
 * variants must not collapse into one the moment two of them share a model.
 * An empty string would make every one of them a duplicate of the others.
 *
 * Built from SLUGS rather than uuids so the stored column stays readable — it is
 * the thing somebody stares at when two products collide, and a row of uuids
 * answers nothing.
 */
export const variantSignature = (slugs: string[]): string | null => {
  const cleaned = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  return cleaned.length > 0 ? cleaned.sort().join("+") : null;
};
