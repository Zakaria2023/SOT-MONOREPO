import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  char,
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import {
  certificationStatuses,
  partnerCapabilities,
  trainingDeliveryModes,
  trainingRegistrationStatuses,
} from "../enum";
import { Brands } from "./brands";

// ---------------------------------------------------------------------------
// 7.1 / 7.2 — THE ROUTE TO A CAPABILITY.
//
// A9 and P2 were both blocked on one question: how does a partner earn a badge?
// The answer is a chain, and every link is a gate.
//
//   COURSE      what can be learned, and which capability it unlocks
//     ↓
//   SESSION     a date, a room, a capacity
//     ↓
//   REGISTRATION  registered → attended → assessed
//     ↓
//   CERTIFICATE   issued on a PASS, verified by SOT, and it expires
//     ↓
//   CAPABILITY    granted only while a valid verified certificate exists
//
// THE TWO GATES ARE WHY THIS IS FIVE TABLES AND NOT TWO.
//
// Attendance is not achievement. `attended` and `passed` are separate states
// because somebody who sat in a room for a day has demonstrated that they can sit
// in a room, and a certificate issued for that is worth nothing to the customer
// whose fire system they go on to install.
//
// A certificate SOT has not seen is not evidence. Same reasoning as
// `firmwareVerified` on a Space item: a partner may hold a vendor certificate we
// have never laid eyes on, and it unlocks nothing until somebody here has.
// ---------------------------------------------------------------------------

export const TrainingCourses = mysqlTable(
  "TrainingCourses",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    title: varchar("title", { length: 255 }).notNull(),
    summary: text("summary"),

    // The vendor behind it. Vendor-supported training is a genuine
    // partner-acquisition lever, so whose course it is belongs on the record.
    // Nullable because SOT runs its own courses too.
    brandUuid: char("brand_uuid", { length: 36 }).references(() => Brands.uuid, {
      onDelete: "set null",
    }),

    // Which system it is about, in the vendor's words — "Fibra", "Access
    // control". Free text rather than an enum: the vocabulary is the vendor's and
    // it changes with their product line, and an enum here would need a migration
    // every time somebody launched a course.
    system: varchar("system", { length: 120 }),

    // WHAT PASSING THIS UNLOCKS. The single most important column here — it is the
    // link between the training module and the capability model, and without it a
    // course is a webinar nobody has a reason to attend.
    //
    // Nullable: a course can be worth running for its own sake without granting
    // anything.
    unlocksCapability: mysqlEnum("unlocks_capability", partnerCapabilities),

    // How long a certificate from this course lasts. Null means it does not
    // expire, which is a real case for foundational training and a deliberate
    // choice rather than an oversight — see `Certifications.expiresOn`.
    validForMonths: int("valid_for_months"),

    // Whether a pass is even possible. A course with no assessment cannot issue a
    // certificate, and saying so here stops somebody wondering why attendance did
    // not unlock anything.
    hasAssessment: int("has_assessment").default(1).notNull(),
    // The mark needed. Percent.
    passMark: int("pass_mark").default(70).notNull(),

    active: int("active").default(1).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_training_courses_brand").on(table.brandUuid),
    index("idx_training_courses_capability").on(table.unlocksCapability),
  ],
);

// One scheduled running of a course.
export const TrainingSessions = mysqlTable(
  "TrainingSessions",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    courseUuid: char("course_uuid", { length: 36 })
      .notNull()
      .references(() => TrainingCourses.uuid, { onDelete: "cascade" }),

    mode: mysqlEnum("mode", trainingDeliveryModes).notNull(),

    // A calendar date. Null for self-paced, which has no date to attend at — and
    // that nullability is why mode is stored: capacity and dates mean different
    // things for a room, a webinar and a course somebody works through alone.
    heldOn: date("held_on", { mode: "string" }),
    // Free text: "09:00–13:00", "two evenings". A pair of timestamps would be
    // false precision on something arranged by phone.
    timing: varchar("timing", { length: 120 }),

    // Where, or the joining link. One column because a room and a URL answer the
    // same question — how do I get there.
    location: varchar("location", { length: 500 }),

    // Null means uncapped, which is the honest default for a webinar. Enforced in
    // the service, where the count of live registrations can be seen.
    capacity: int("capacity"),

    trainerName: varchar("trainer_name", { length: 255 }),
    notes: text("notes"),

    cancelledAt: timestamp("cancelled_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_training_sessions_course").on(table.courseUuid),
    index("idx_training_sessions_held_on").on(table.heldOn),
  ],
);

// One partner on one session.
export const TrainingRegistrations = mysqlTable(
  "TrainingRegistrations",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),

    sessionUuid: char("session_uuid", { length: 36 })
      .notNull()
      .references(() => TrainingSessions.uuid, { onDelete: "cascade" }),

    // By Clerk id with the name denormalised, like every other partner-facing
    // record here: the register still reads after somebody leaves the company and
    // their profile goes.
    partnerClerkUserId: varchar("partner_clerk_user_id", { length: 64 }).notNull(),
    partnerName: varchar("partner_name", { length: 255 }),

    status: mysqlEnum("status", trainingRegistrationStatuses)
      .default("registered")
      .notNull(),

    attendedAt: timestamp("attended_at"),

    // The assessment. Null until it is sat — and `assessmentScore` being null is
    // exactly what stops a certificate being issued, because the gate reads this
    // and not `attendedAt`.
    assessmentScore: int("assessment_score"),
    assessedAt: timestamp("assessed_at"),
    assessedBy: varchar("assessed_by", { length: 255 }),
    assessmentNotes: text("assessment_notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_training_regs_session").on(table.sessionUuid),
    index("idx_training_regs_partner").on(table.partnerClerkUserId),
    index("idx_training_regs_status").on(table.status),
  ],
);

// 7.2 — the certificate itself.
export const Certifications = mysqlTable(
  "Certifications",
  {
    id: int("id").primaryKey().autoincrement(),
    uuid: char("uuid", { length: 36 }).notNull().unique(),
    reference: varchar("reference", { length: 50 }).notNull().unique(),

    partnerClerkUserId: varchar("partner_clerk_user_id", { length: 64 }).notNull(),
    partnerName: varchar("partner_name", { length: 255 }),

    // What it certifies them for. This is what the capability gate reads.
    capability: mysqlEnum("capability", partnerCapabilities).notNull(),

    // Where it came from. Null for one recorded by hand — a partner certified by a
    // vendor directly, before or outside SOT's own training. That path has to
    // exist, and making it a null rather than a flag keeps "which session" and
    // "was there a session" one question.
    registrationUuid: char("registration_uuid", { length: 36 }).references(
      () => TrainingRegistrations.uuid,
      { onDelete: "set null" },
    ),

    // Whose certificate it is, when it is not ours. Free text: "Ajax Systems",
    // "SBC".
    issuedByName: varchar("issued_by_name", { length: 255 }),
    // The number on the paper, so it can be checked against the issuer.
    externalReference: varchar("external_reference", { length: 120 }),
    // R2 document id for the scan.
    documentId: varchar("document_id", { length: 64 }),

    status: mysqlEnum("status", certificationStatuses)
      .default("pending_verification")
      .notNull(),

    issuedOn: date("issued_on", { mode: "string" }).notNull(),
    // NULL MEANS IT DOES NOT EXPIRE, and that is a deliberate value rather than a
    // missing one. Foundational training genuinely does not lapse. The alternative
    // — a far-future date — would be a lie the schedule would eventually surface.
    expiresOn: date("expires_on", { mode: "string" }),

    // Who at SOT checked it, and when. Until this is set the certificate unlocks
    // nothing: a certificate nobody has looked at is a claim, not evidence.
    verifiedBy: varchar("verified_by", { length: 255 }),
    verifiedAt: timestamp("verified_at"),

    revokedAt: timestamp("revoked_at"),
    revokedReason: varchar("revoked_reason", { length: 500 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_certifications_partner").on(table.partnerClerkUserId),
    index("idx_certifications_capability").on(table.capability),
    index("idx_certifications_status").on(table.status),
    // Expiry is read as "what lapses soon", across every partner, so the date is a
    // filter and not just a displayed field.
    index("idx_certifications_expires_on").on(table.expiresOn),
  ],
);

export type SelectTrainingCourses = InferSelectModel<typeof TrainingCourses>;
export type InsertTrainingCourses = InferInsertModel<typeof TrainingCourses>;
export type SelectTrainingSessions = InferSelectModel<typeof TrainingSessions>;
export type InsertTrainingSessions = InferInsertModel<typeof TrainingSessions>;
export type SelectTrainingRegistrations = InferSelectModel<
  typeof TrainingRegistrations
>;
export type InsertTrainingRegistrations = InferInsertModel<
  typeof TrainingRegistrations
>;
export type SelectCertifications = InferSelectModel<typeof Certifications>;
export type InsertCertifications = InferInsertModel<typeof Certifications>;
