import { sql, type SQL } from "drizzle-orm";
import type { MySqlColumn } from "drizzle-orm/mysql-core";

/**
 * Build one `CASE` expression mapping each uuid to its position, so a reorder
 * collapses into a single `UPDATE ... WHERE uuid IN (...)` instead of one
 * statement per row.
 *
 * The drag-and-drop boards post the whole sibling list on every drop, so the
 * straightforward loop cost a round trip per row. Against a remote database
 * (~115ms each) that puts a plain reorder past five seconds at roughly forty
 * siblings, and it grows linearly from there. One statement is also atomic on
 * its own, so the surrounding transaction is no longer doing any work.
 *
 * Pair this with an `inArray` filter on the same column: rows outside the list
 * fall through the `CASE` with no matching branch, and must not be updated.
 */
export const orderCase = (
  keyColumn: MySqlColumn,
  orderedUuids: string[],
): SQL =>
  sql`case ${sql.join(
    orderedUuids.map(
      (uuid, index) => sql`when ${keyColumn} = ${uuid} then ${index}`,
    ),
    sql` `,
  )} end`;
