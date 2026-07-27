import { eq } from "drizzle-orm";
import { db } from ".";
import { Products } from "./schema/products";
import { Specifications } from "./schema/specifications";
import type { ProductValues, SpecOption } from "./types";

// ---------------------------------------------------------------------------
// ONE-OFF MIGRATION: the old string-keyed, string-valued spec model → the new
// uuid-keyed, typed one.
//
// Run it ONCE, after `db:push` has added the new columns and before anything
// writes through the new services:
//
//     pnpm dlx tsx db/migrate-spec-model.ts            # dry run, reports only
//     pnpm dlx tsx db/migrate-spec-model.ts --write    # actually writes
//
// What changes, and why it cannot be skipped:
//
//   1. Product values were keyed by a LABEL-DERIVED SLUG ("poe-budget") and are
//      now keyed by the attribute's immutable uuid. Renaming an attribute used to
//      re-slug the key and silently orphan every stored value; nothing points at
//      the slug any more.
//   2. Values were STRINGS. "12" is now 12, "802.3af, 802.3at" is now
//      ["af", "at"], and "Yes" is now true. The engine sums these directly, so a
//      string that parses to NaN is no longer something it can be handed.
//   3. Options were bare values with no rank and no retirement. An ordered scale
//      now needs an explicit rank per option, because deriving order from array
//      position is silently wrong the moment somebody types the list out of
//      sequence.
//
// The old `technical_attributes` column is left in place. Verify the report,
// confirm the storefront reads correctly, and drop it afterwards — an
// irreversible delete in the same pass as a type change is how a bad migration
// becomes a bad afternoon.
// ---------------------------------------------------------------------------

const WRITE = process.argv.includes("--write");

type LegacySpec = {
  uuid: string;
  key: string;
  label: string;
  type: string;
  ordered: boolean;
  options: SpecOption[] | null;
};

type Report = {
  productsScanned: number;
  productsWritten: number;
  valuesMigrated: number;
  // A stored key with no attribute to match. Usually an attribute deleted after
  // the value was written; the value is dropped, and named here so nobody has to
  // guess what was lost.
  orphanedKeys: Map<string, number>;
  // A value the new type could not accept — a non-numeric string in a number
  // field, or an option value that is not in the master list.
  unparsed: { product: string; label: string; raw: string }[];
};

/** "802.3af, 802.3at" → ["802.3af", "802.3at"] — the old multi-select encoding. */
const splitLegacyValues = (raw: string): string[] =>
  raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");

/**
 * Map a legacy stored value onto an option's stable `value`.
 *
 * The old rows stored the LABEL ("802.3af"), while the new model stores a slug.
 * So the match is tried against the option's value first, then its label, then a
 * case-insensitive label — because a hand-typed catalog will not be consistent.
 */
const matchOption = (
  options: SpecOption[],
  raw: string,
): SpecOption | undefined => {
  const needle = raw.trim();
  const lower = needle.toLowerCase();
  return (
    options.find((option) => option.value === needle) ??
    options.find((option) => option.label === needle) ??
    options.find((option) => option.label.toLowerCase() === lower) ??
    options.find((option) => option.value.toLowerCase() === lower)
  );
};

const convertValue = (
  spec: LegacySpec,
  raw: string,
  productName: string,
  report: Report,
): ProductValues[string] | undefined => {
  const value = raw.trim();
  if (value === "") {
    return undefined;
  }

  if (spec.type === "number") {
    // The old encoding allowed ranges ("220 - 240"). Ranges are gone; the
    // migration keeps the WORST case, because that is what a budget check needs
    // and quietly halving a demand figure is the dangerous direction.
    const rangeAt = value.indexOf(" - ");
    const candidate =
      rangeAt === -1 ? value : value.slice(rangeAt + 3).trim() || value;
    const parsed = Number(candidate);
    if (!Number.isFinite(parsed)) {
      report.unparsed.push({ product: productName, label: spec.label, raw });
      return undefined;
    }
    return parsed;
  }

  if (spec.type === "boolean") {
    const lower = value.toLowerCase();
    if (lower === "yes" || lower === "true") {
      return true;
    }
    if (lower === "no" || lower === "false") {
      return false;
    }
    report.unparsed.push({ product: productName, label: spec.label, raw });
    return undefined;
  }

  const options = spec.options ?? [];
  const parts = splitLegacyValues(value);
  const matched = parts.flatMap((part) => {
    const option = matchOption(options, part);
    if (!option) {
      report.unparsed.push({ product: productName, label: spec.label, raw: part });
      return [];
    }
    return [option.value];
  });

  if (matched.length === 0) {
    return undefined;
  }
  if (spec.type === "multi_select") {
    return matched;
  }
  return matched[0];
};

const migrate = async (): Promise<void> => {
  const specs = await db
    .select({
      uuid: Specifications.uuid,
      key: Specifications.key,
      label: Specifications.label,
      type: Specifications.type,
      ordered: Specifications.ordered,
      options: Specifications.options,
    })
    .from(Specifications);

  const byKey = new Map<string, LegacySpec>(
    specs.map((spec) => [spec.key, spec]),
  );

  const products = await db
    .select({
      uuid: Products.uuid,
      name: Products.name,
      specValues: Products.specValues,
      technicalAttributes: Products.technicalAttributes,
    })
    .from(Products);

  const report: Report = {
    productsScanned: products.length,
    productsWritten: 0,
    valuesMigrated: 0,
    orphanedKeys: new Map(),
    unparsed: [],
  };

  for (const product of products) {
    const legacy = product.technicalAttributes;
    if (!legacy || Object.keys(legacy).length === 0) {
      continue;
    }
    // Already migrated — never overwrite values written through the new model.
    if (product.specValues && Object.keys(product.specValues).length > 0) {
      continue;
    }

    const next: ProductValues = {};
    for (const [key, raw] of Object.entries(legacy)) {
      const spec = byKey.get(key);
      if (!spec) {
        report.orphanedKeys.set(key, (report.orphanedKeys.get(key) ?? 0) + 1);
        continue;
      }
      const converted = convertValue(spec, String(raw), product.name, report);
      if (converted !== undefined) {
        next[spec.uuid] = converted;
        report.valuesMigrated += 1;
      }
    }

    if (Object.keys(next).length === 0) {
      continue;
    }
    report.productsWritten += 1;
    if (WRITE) {
      await db
        .update(Products)
        .set({ specValues: next })
        .where(eq(Products.uuid, product.uuid));
    }
  }

  console.log(
    WRITE ? "\n=== MIGRATION APPLIED ===" : "\n=== DRY RUN (no writes) ===",
  );
  console.log(`Attributes in library:   ${specs.length}`);
  console.log(`Products scanned:        ${report.productsScanned}`);
  console.log(`Products to write:       ${report.productsWritten}`);
  console.log(`Values migrated:         ${report.valuesMigrated}`);

  if (report.orphanedKeys.size > 0) {
    console.log(
      `\nOrphaned keys (no attribute matches — these values are DROPPED):`,
    );
    for (const [key, occurrences] of [...report.orphanedKeys].sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(`  ${key} — on ${occurrences} product(s)`);
    }
  }

  if (report.unparsed.length > 0) {
    console.log(
      `\nUnconvertible values (${report.unparsed.length}) — fix these by hand after the run:`,
    );
    for (const entry of report.unparsed.slice(0, 40)) {
      console.log(`  ${entry.product} · ${entry.label} = "${entry.raw}"`);
    }
    if (report.unparsed.length > 40) {
      console.log(`  … and ${report.unparsed.length - 40} more`);
    }
  }

  if (!WRITE) {
    console.log(
      "\nNothing was written. Re-run with --write once the report above looks right.",
    );
  } else {
    console.log(
      "\nDone. `technical_attributes` was left untouched — verify the storefront, then drop that column.",
    );
  }
  process.exit(0);
};

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
