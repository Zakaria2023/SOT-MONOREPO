import { sql } from "drizzle-orm";
import {
  deriveSpecificationType,
  reshapeOptions,
  type LegacyOption,
  type LegacySpec,
} from "../packages/services/src/legacy-spec-migration";
import { db } from ".";

// ---------------------------------------------------------------------------
// PRE-PUSH STEP. Run this BEFORE `pnpm db:push`, exactly once.
//
//     pnpm dlx tsx db/prepare-spec-model.ts            # dry run, reports only
//     pnpm dlx tsx db/prepare-spec-model.ts --write    # applies
//
// WHY IT HAS TO COME FIRST
//
// `db:push` would add `Specifications.type` as NOT NULL with no default, which
// MySQL backfills on existing rows with the first enum value — so every
// attribute in the library would silently become a `number`. In the SAME run it
// drops `value_type` and `input_type`, which are the only places the real type is
// recorded. After that the information is gone and no later script can recover
// it.
//
// The option lists have the same problem in a quieter form: the old shape was
// `{ value, children }` and the new one is `{ value, label, rank, retired }`, so
// after a push every option would carry a blank label and a null rank. A null
// rank is not a cosmetic loss — it is what `at most` comparisons read, so every
// ordered rule would stop working while still reporting a pass.
//
// So this script adds the new columns as NULLABLE, derives their values from the
// old ones, and leaves `db:push` with nothing left to guess.
// ---------------------------------------------------------------------------

const WRITE = process.argv.includes("--write");

type LegacySpecRow = {
  uuid: string;
  label: string;
  value_type: string | null;
  input_type: string | null;
  allow_multiple: number | null;
  allow_range: number | null;
  ordered: number | null;
  options: unknown;
};

/** The stored JSON, whatever shape it is in, as a list of option objects. */
const readOptions = (row: LegacySpecRow): LegacyOption[] => {
  const raw = row.options;
  if (!raw) {
    return [];
  }
  const parsed = typeof raw === "string" ? safeParse(raw) : raw;
  return Array.isArray(parsed) ? (parsed as LegacyOption[]) : [];
};

const safeParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** A database row as the tested transformation expects it. */
const toLegacySpec = (row: LegacySpecRow): LegacySpec => ({
  label: row.label,
  valueType: row.value_type,
  inputType: row.input_type,
  allowMultiple: Number(row.allow_multiple ?? 0) === 1,
  allowRange: Number(row.allow_range ?? 0) === 1,
  ordered: Number(row.ordered ?? 0) === 1,
  options: readOptions(row),
});

const columnExists = async (
  table: string,
  column: string,
): Promise<boolean> => {
  const result = await db.execute(
    sql`SELECT COUNT(*) AS n FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ${table}
          AND column_name = ${column}`,
  );
  const rows = result as unknown as { n: number | string }[][];
  const first = rows[0]?.[0];
  return Number(first?.n ?? 0) > 0;
};

const addNullableColumn = async (
  table: string,
  column: string,
  definition: string,
): Promise<boolean> => {
  if (await columnExists(table, column)) {
    return false;
  }
  if (WRITE) {
    await db.execute(
      sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`),
    );
  }
  return true;
};

const prepare = async (): Promise<void> => {
  console.log(
    WRITE ? "\n=== PREPARING (writing) ===" : "\n=== DRY RUN (no writes) ===",
  );

  // The old columns have to still be here — that is the whole point of running
  // this before the push.
  const hasValueType = await columnExists("Specifications", "value_type");
  const hasInputType = await columnExists("Specifications", "input_type");
  if (!hasValueType && !hasInputType) {
    console.log(
      "\nvalue_type and input_type are both already gone from Specifications.\n" +
        "That means db:push has already run, and the original attribute types\n" +
        "cannot be recovered from the database. Restore a backup from before the\n" +
        "push, then run this script first.",
    );
    process.exit(1);
  }

  // Nullable on purpose: db:push tightens them to NOT NULL afterwards, once every
  // row has a real value.
  const added: string[] = [];
  const columns: [string, string, string][] = [
    [
      "Specifications",
      "type",
      "ENUM('number','single_select','multi_select','boolean') NULL",
    ],
    ["Specifications", "internal_name", "VARCHAR(255) NULL"],
    ["Specifications", "description", "VARCHAR(500) NULL"],
    ["Products", "spec_values", "JSON NULL"],
    ["SpecificationCategories", "suppressed", "BOOLEAN NOT NULL DEFAULT FALSE"],
  ];
  for (const [table, column, definition] of columns) {
    if (await addNullableColumn(table, column, definition)) {
      added.push(`${table}.${column}`);
    }
  }
  console.log(
    added.length > 0
      ? `\nColumns to add: ${added.join(", ")}`
      : "\nAll new columns already present.",
  );

  const result = await db.execute(
    sql`SELECT uuid, label, value_type, input_type, allow_multiple, allow_range,
               ordered, options
        FROM Specifications`,
  );
  const rows = (result as unknown as LegacySpecRow[][])[0] ?? [];

  const byType = new Map<string, number>();
  const notes: string[] = [];
  const ranged: string[] = [];
  let optionsReshaped = 0;

  for (const row of rows) {
    const spec = toLegacySpec(row);
    const { type, note } = deriveSpecificationType(spec);
    byType.set(type, (byType.get(type) ?? 0) + 1);
    if (note) {
      notes.push(`  ${row.label} — ${note}`);
    }
    // Ranges are gone: a consumer had to be read at its max and a provider at its
    // min, which made every rule ambiguous. These need splitting into two plain
    // numeric attributes by hand.
    if (spec.allowRange) {
      ranged.push(`  ${row.label}`);
    }

    const options = reshapeOptions(spec, type);
    if (options.length > 0) {
      optionsReshaped += 1;
    }

    if (WRITE) {
      await db.execute(
        sql`UPDATE Specifications
            SET type = ${type},
                options = ${JSON.stringify(options)}
            WHERE uuid = ${row.uuid}`,
      );
    }
  }

  console.log(`\nAttributes: ${rows.length}`);
  for (const [type, count] of [...byType].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type.padEnd(14)} ${count}`);
  }
  console.log(`Option lists reshaped: ${optionsReshaped}`);

  if (notes.length > 0) {
    console.log(`\nNeeds a human look (${notes.length}):`);
    console.log(notes.join("\n"));
  }
  if (ranged.length > 0) {
    console.log(
      `\nUsed the old from–to RANGE, which no longer exists (${ranged.length}).\n` +
        "Split each into two plain numeric attributes (e.g. a min and a max) and\n" +
        "re-point any rule that read it:",
    );
    console.log(ranged.join("\n"));
  }

  if (!WRITE) {
    console.log(
      "\nNothing was written. Re-run with --write once the report above looks right,\n" +
        "then run `pnpm db:push`, then `pnpm dlx tsx db/migrate-spec-model.ts`.",
    );
  } else {
    console.log(
      "\nDone. Now run:\n" +
        "  pnpm db:push                                  (drops the dead columns)\n" +
        "  pnpm dlx tsx db/migrate-spec-model.ts         (dry run of the values)\n" +
        "  pnpm dlx tsx db/migrate-spec-model.ts --write (backfills spec_values)",
    );
  }
  process.exit(0);
};

prepare().catch((error) => {
  console.error("prepare-spec-model failed:", error);
  process.exit(1);
});
