import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  index,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { ProjectAnswers, ScenarioLine, ScenarioSnapshot } from "../types";

// A BASKET SOMEBODY DECIDED WAS WORTH RE-CHECKING.
//
// The sandbox proves a rule set behaves correctly ONCE, in front of whoever ran
// it. The next person to edit a rule has no way to find out they broke that,
// because nothing kept the basket or the answer. So the interesting baskets —
// the one that caught the PoE bug, the one nobody could get to pass — are kept
// here with the verdict that was agreed at the time.
//
// This is the regression suite, and it is a table rather than a test file for
// one reason: the data it runs against is the live catalogue, which the people
// who need these checks are editing all day and cannot commit to a repo.
//
// What it stores is deliberately statuses and uuids, never the engine's
// sentences. Findings are prose and get reworded; a suite that failed on every
// wording improvement would be switched off inside a week.

export const DesignScenarios = mysqlTable(
  "DesignScenarios",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    name: varchar("name", { length: 255 }).notNull(),

    // Why this basket is worth keeping. Optional, and worth asking for: a
    // scenario nobody can explain in a year is one nobody dares delete either.
    note: text("note"),

    selection: json("selection").$type<ScenarioLine[]>().notNull(),

    // The project answers in force when the verdict was agreed. Stored with the
    // basket because the same products with a different answer are a different
    // scenario — that is the whole point of the questions.
    variables: json("variables").$type<ProjectAnswers>().notNull(),

    // The agreed answer. Null until somebody accepts one: a scenario saved from
    // a run nobody has vouched for is a recorded observation, not a baseline,
    // and treating the two the same would let a bug become the expectation.
    expected: json("expected").$type<ScenarioSnapshot | null>(),

    // Who agreed it, and when. A baseline with no name on it is one nobody can
    // ask about when it starts failing.
    baselinedBy: varchar("baselined_by", { length: 255 }),
    baselinedAt: timestamp("baselined_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("idx_design_scenarios_name").on(table.name)],
);

export type SelectDesignScenarios = InferSelectModel<typeof DesignScenarios>;
export type InsertDesignScenarios = InferInsertModel<typeof DesignScenarios>;
