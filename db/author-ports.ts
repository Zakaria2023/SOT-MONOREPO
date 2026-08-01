import { eq } from "drizzle-orm";
import { db } from ".";
import { Categories } from "./schema/categories";
import { Relationships } from "./schema/relationships";
import { SpecificationGroups } from "./schema/specification-groups";
import { SpecificationOptionSets } from "./schema/specification-option-sets";
import { Specifications } from "./schema/specifications";
import type { Predicate } from "./types";
import {
  createLibraryAttribute,
  createRelationship,
  invalidateCatalogModel,
  saveAssignments,
  validateRelationship,
  type AssignmentInput,
  type LibraryAttributeInput,
  type RelationshipInput,
} from "../packages/services/src/index";

// ---------------------------------------------------------------------------
// THE PORT MODEL.
//
// Four shared lists were authored and then borrowed by nothing: Port speed, Port
// family, Media type. This is what borrows them.
//
// The fact a switch has is not "uplink speed: 10". It is a LIST — 48 × 1G BASE-T
// copper, 4 × 10G SFP fibre — and that is why the flat `Uplink Speed` /
// `Downlink Media Type` pairs could never answer a real question. One number per
// switch cannot say which of its cages a module goes in, and a catalog that
// cannot say that cannot check a transceiver against a switch at all.
//
// So: one `group` attribute holding {family, speed, medium, count}, the module
// side that meets it, the cable side that carries it, and the three rules the
// design conversation named.
//
// IDEMPOTENT, like author-power-and-wireless: every step looks for what it would
// create before creating it, so a re-run after a partial failure finishes the job
// rather than authoring a second "Network Ports" that half the catalog then
// answers instead of the first.
//
// EVERY RULE IS AUTHORED AS A DRAFT. A published rule gates real carts the
// instant it is written, and these have never run against the live catalog. They
// are previewed on the Relations tab and published by a human.
//
// WHAT IT DELIBERATELY DOES NOT DO: it does not touch `Uplink Speed`,
// `Downlink Speed`, `Uplink Media Type`, `Downlink Media Type` or
// `Downlink Ports`. A PUBLISHED rule reads them, and re-pointing live rules at a
// new attribute is a decision with a blast radius, not a migration a script
// should take on its own. See the note printed at the end.
// ---------------------------------------------------------------------------

const ACTOR = { uuid: "system-authoring", name: "Catalog authoring script" };

const PORTS = "Network Ports";
const MODULE_FAMILY = "Module Family";
const MODULE_SPEED = "Module Speed";
const CABLE_CATEGORY = "Cable Category";
const CABLE_RATED_SPEED = "Cable Rated Speed";
const CABLE_LENGTH = "Cable Length";

type Plan = {
  attribute: LibraryAttributeInput;
  categories: string[];
};

const main = async () => {
  // -------------------------------------------------------------------------
  // What is already there
  // -------------------------------------------------------------------------
  const [groups, categories, sets, existing] = await Promise.all([
    db.select().from(SpecificationGroups),
    db.select().from(Categories),
    db.select().from(SpecificationOptionSets),
    db.select().from(Specifications),
  ]);

  const named = <T extends { name: string; uuid: string }>(
    rows: T[],
    name: string,
    kind: string,
  ): T => {
    const found = rows.find((row) => row.name === name);
    if (!found) {
      throw new Error(
        `${kind} "${name}" not found. Nothing was written — fix the name and re-run.`,
      );
    }
    return found;
  };

  const portsGroup = named(groups, "Ports & Switching", "Library group").uuid;
  const cablingGroup = named(groups, "Cabling & Passive", "Library group").uuid;

  // The shared vocabularies. Borrowed, never re-typed: the whole point is that a
  // switch's cage family and a module's family spell "SFP" identically, and two
  // attributes on their own lists can never be compared however alike the options
  // look.
  const portSpeed = named(sets, "Port speed", "Shared list");
  const portFamily = named(sets, "Port family", "Shared list");
  const mediaType = named(sets, "Media type", "Shared list");

  const categoryId = (name: string): string =>
    named(categories, name, "Category").uuid;

  // Branch scope: every switch under Networking > Switch inherits, rather than
  // SOHO / SMB / Industrial each being wired by hand.
  const SWITCHES = [categoryId("Switch")];
  const MODULES = [categoryId("SFP & QSFP")];
  const COPPER_CABLES = [categoryId("Copper Cables")];

  // -------------------------------------------------------------------------
  // The attributes
  // -------------------------------------------------------------------------
  const borrowed = (
    label: string,
    groupUuid: string,
    setUuid: string,
    description: string,
  ): LibraryAttributeInput => ({
    groupUuid,
    label,
    internalName: null,
    description,
    type: "single_select",
    unit: null,
    // Both ignored when a shared list is named — the set owns whether its own
    // words are a scale.
    ordered: false,
    allowRange: false,
    audience: "everyone",
    options: [],
    optionSetUuid: setUuid,
    groupFields: [],
  });

  const plans: Plan[] = [
    {
      attribute: {
        groupUuid: portsGroup,
        label: PORTS,
        internalName: null,
        description:
          "Every group of identical ports the device has — 48 × 1G BASE-T copper, then 4 × 10G SFP fibre. Add a row per group. This is the fact a rule reads to decide whether a transceiver fits.",
        type: "group",
        unit: null,
        ordered: false,
        allowRange: false,
        audience: "everyone",
        options: [],
        optionSetUuid: null,
        groupFields: [
          {
            label: "Family",
            kind: "select",
            unit: null,
            ordered: false,
            options: [],
            optionSetUuid: portFamily.uuid,
          },
          {
            label: "Speed",
            kind: "select",
            unit: null,
            ordered: false,
            options: [],
            optionSetUuid: portSpeed.uuid,
          },
          {
            label: "Medium",
            kind: "select",
            unit: null,
            ordered: false,
            options: [],
            optionSetUuid: mediaType.uuid,
          },
          {
            label: "Ports",
            kind: "number",
            unit: "ports",
            ordered: false,
            options: [],
          },
        ],
      },
      categories: SWITCHES,
    },
    {
      attribute: borrowed(
        MODULE_FAMILY,
        portsGroup,
        portFamily.uuid,
        "The cage this module physically seats in. Compared against the families the switch actually has — an SFP module does not go in a QSFP cage however well the speeds line up.",
      ),
      categories: MODULES,
    },
    {
      attribute: borrowed(
        MODULE_SPEED,
        portsGroup,
        portSpeed.uuid,
        "The rate this module runs at. A module below the cage's rate seats perfectly and the link then runs at the module's rate, which is what the downshift notice is for.",
      ),
      categories: MODULES,
    },
    {
      attribute: {
        groupUuid: cablingGroup,
        label: CABLE_CATEGORY,
        internalName: null,
        description:
          "The grade of the copper. An ORDERED scale, because the whole point is that a higher grade carries a given speed further.",
        type: "single_select",
        unit: null,
        ordered: true,
        allowRange: false,
        audience: "everyone",
        // Its OWN list, not a shared one. No other attribute needs to be
        // comparable with a cable grade, and a set exists to make two attributes
        // comparable — creating one for a single user is ceremony.
        //
        // Ranks spaced by 100 so a grade can be inserted between two that already
        // exist without renumbering the products holding them.
        options: [
          { label: "Cat5e", rank: 100 },
          { label: "Cat6", rank: 200 },
          { label: "Cat6a", rank: 300 },
          { label: "Cat7", rank: 400 },
          { label: "Cat8", rank: 500 },
        ],
        optionSetUuid: null,
        groupFields: [],
      },
      categories: COPPER_CABLES,
    },
    {
      attribute: borrowed(
        CABLE_RATED_SPEED,
        cablingGroup,
        portSpeed.uuid,
        "The rate this run has to carry. It is what makes the distance limit answerable: Cat6 does 100 m at 1G and 55 m at 10G, so the grade alone does not decide it.",
      ),
      categories: COPPER_CABLES,
    },
    {
      attribute: {
        groupUuid: cablingGroup,
        label: CABLE_LENGTH,
        internalName: null,
        description:
          "The length of this run, in metres. Checked against what the grade supports at the rate it has to carry.",
        type: "number",
        unit: "m",
        ordered: false,
        // A single figure. A run is one length, not a window — and a span here
        // would be read at its worst case, which is not what a reel of cable is.
        allowRange: false,
        audience: "everyone",
        options: [],
        optionSetUuid: null,
        groupFields: [],
      },
      categories: COPPER_CABLES,
    },
  ];

  const uuidByLabel = new Map(existing.map((spec) => [spec.label, spec.uuid]));

  console.log("Attributes");
  for (const plan of plans) {
    const label = plan.attribute.label;
    if (uuidByLabel.has(label)) {
      console.log(`  = ${label} already exists`);
      continue;
    }
    const uuid = await createLibraryAttribute(plan.attribute, ACTOR);
    uuidByLabel.set(label, uuid);
    console.log(`  + ${label}`);
  }

  const attributeId = (label: string): string => {
    const uuid = uuidByLabel.get(label);
    if (!uuid) {
      throw new Error(`"${label}" was not created`);
    }
    return uuid;
  };

  // -------------------------------------------------------------------------
  // The assignments
  // -------------------------------------------------------------------------
  const rows: AssignmentInput[] = plans.flatMap((plan) =>
    plan.categories.map((categoryUuid, index) => ({
      categoryUuid,
      specificationUuid: attributeId(plan.attribute.label),
      // The engine reads these; the shopper does not filter on them until
      // somebody decides that on the assignments screen.
      isFilter: false,
      isRule: true,
      // Mandatory. A switch with no port rows passes every port check in
      // silence, which is the exact failure this model exists to make visible.
      optional: false,
      scope: "branch" as const,
      showIf: null,
      audience: "everyone" as const,
      enabledValues: null,
      suppressed: false,
      order: index,
    })),
  );
  await saveAssignments(rows, { actor: ACTOR });
  console.log(`\nAssignments\n  ${rows.length} row(s)`);

  // -------------------------------------------------------------------------
  // The rules
  // -------------------------------------------------------------------------

  // A shared list's option VALUES, never its labels — a rule keyed on a label
  // breaks the day somebody rewords it.
  const setValue = (set: typeof portFamily, label: string): string => {
    const found = (set.options ?? []).find((option) => option.label === label);
    if (!found) {
      throw new Error(`Shared list "${set.name}" has no option "${label}"`);
    }
    return found.value;
  };

  const [cableCategory] = await db
    .select()
    .from(Specifications)
    .where(eq(Specifications.uuid, attributeId(CABLE_CATEGORY)));
  if (!cableCategory) {
    throw new Error(`"${CABLE_CATEGORY}" disappeared`);
  }
  const gradeValue = (label: string): string => {
    const found = (cableCategory.options ?? []).find(
      (option) => option.label === label,
    );
    if (!found) {
      throw new Error(`"${CABLE_CATEGORY}" has no option "${label}"`);
    }
    return found.value;
  };

  const isFamily = (label: string): Predicate => ({
    op: "equals",
    attr: attributeId(MODULE_FAMILY),
    value: setValue(portFamily, label),
  });

  // A lookup row, keyed on the cable grade and the rate the run must carry.
  const run = (grade: string, speed: string, metres: number) => ({
    when: {
      op: "all" as const,
      children: [
        {
          op: "equals" as const,
          attr: attributeId(CABLE_CATEGORY),
          value: gradeValue(grade),
        },
        {
          op: "equals" as const,
          attr: attributeId(CABLE_RATED_SPEED),
          value: setValue(portSpeed, speed),
        },
      ],
    },
    limit: metres,
  });

  const rules: RelationshipInput[] = [
    {
      name: "A module must fit a cage the switch has",
      description:
        "The seat check. A module's family is compared against the families the switch's port rows actually offer — an SFP module in a box with only BASE-T and QSFP has nowhere to go, whatever the speeds say.",
      family: "match",
      gate: "block",
      comparator: "in",
      matchMode: "any",
      headroomPercent: 100,
      ratioLimit: null,
      allocation: "per_unit",
      perItem: false,
      consumer: { source: "spec", specUuid: attributeId(MODULE_FAMILY) },
      provider: {
        source: "spec",
        specUuid: attributeId(PORTS),
        groupField: "family",
      },
      consumerWhen: null,
      providerWhen: null,
      lookup: null,
      presence: null,
      scope: null,
    },
    // TWO downshift rules, one per family, and that is not duplication to be
    // factored out. A row filter is a fixed condition, not a correlation with the
    // item on the other side — it cannot say "the rows whose family matches THIS
    // module". Without the family guard the comparison reads "at least as fast as
    // the slowest cage on the switch", which every module satisfies trivially: a
    // rule that passes everything and looks like it is working.
    ...(["SFP (single lane)", "QSFP (quad lane)"] as const).map(
      (familyLabel): RelationshipInput => ({
        name: `${familyLabel.split(" ")[0]} module runs below the cage it sits in`,
        description:
          "A slower module seats perfectly and the link then runs at the module's rate. Worth telling the buyer, and only true when the module is genuinely below the cage — which is why the check is 'at least', warned on, rather than a block.",
        family: "match",
        gate: "warn",
        comparator: "gte",
        matchMode: "any",
        headroomPercent: 100,
        ratioLimit: null,
        allocation: "per_unit",
        perItem: false,
        consumer: { source: "spec", specUuid: attributeId(MODULE_SPEED) },
        provider: {
          source: "spec",
          specUuid: attributeId(PORTS),
          groupField: "speed",
          where: {
            op: "equals",
            attr: "family",
            value: setValue(portFamily, familyLabel),
          },
        },
        consumerWhen: isFamily(familyLabel),
        providerWhen: null,
        lookup: null,
        presence: null,
        scope: null,
      }),
    ),
    {
      name: "A copper run must not exceed what its grade carries",
      description:
        "The distance chain. There is no product on the other side — the table IS the capacity, and the same 80 m passes on Cat6a at 10G and fails on Cat6 at 10G.",
      family: "conditional",
      gate: "block",
      comparator: "lte",
      matchMode: "any",
      headroomPercent: 100,
      ratioLimit: null,
      allocation: "per_unit",
      perItem: false,
      consumer: { source: "spec", specUuid: attributeId(CABLE_LENGTH) },
      provider: null,
      consumerWhen: null,
      providerWhen: null,
      lookup: {
        inputs: [attributeId(CABLE_CATEGORY), attributeId(CABLE_RATED_SPEED)],
        rows: [
          run("Cat5e", "1G", 100),
          run("Cat6", "1G", 100),
          // The row the whole feature exists for.
          run("Cat6", "10G", 55),
          run("Cat6a", "1G", 100),
          run("Cat6a", "10G", 100),
          run("Cat7", "10G", 100),
          run("Cat8", "25G", 30),
        ],
      },
      presence: null,
      scope: null,
    },
  ];

  console.log("\nRules");
  for (const rule of rules) {
    // Validated BEFORE writing. A rule that cannot be evaluated is worse than no
    // rule: it reports "could not be checked" on every cart, and people learn to
    // scroll past it.
    const problems = await validateRelationship(rule);
    if (problems.length > 0) {
      console.log(`  ! ${rule.name}`);
      for (const problem of problems) {
        console.log(`      ${problem.field}: ${problem.message}`);
      }
      continue;
    }
    // `createRelationship` PUBLISHES — deliberately, because in the admin the
    // author has just previewed the rule against a real selection and a draft
    // nobody presses "publish" on is a gate that protects nothing.
    //
    // A script has done no such preview. These four have never been run against
    // the catalog even once, and one of them is a `block` — so they are demoted
    // immediately after creation. The demotion is a separate statement rather
    // than an argument because publishing-by-default is the right behaviour for
    // the screen; it is this caller that is the exception.
    const uuid = await createRelationship(rule, ACTOR);
    await db
      .update(Relationships)
      .set({ status: "draft" })
      .where(eq(Relationships.uuid, uuid));
    console.log(`  + ${rule.name} (draft)`);
  }
  // The cached model still holds them as published — `createRelationship`
  // invalidated on its way out, before the demotion above.
  invalidateCatalogModel();

  console.log(
    [
      "",
      "NEXT, by a human:",
      "  1. Open Assignments > Relations, preview each draft against a real",
      "     selection, then publish it. Nothing above gates a cart until you do.",
      "  2. Fill in Network Ports on the switches. Until a switch has rows, every",
      "     port rule reads it as unanswered and reports it as a gap — which is",
      "     the intended behaviour, not a bug.",
      "",
      "NOT DONE, deliberately: Uplink Speed, Downlink Speed, Uplink Media Type,",
      "Downlink Media Type and Downlink Ports were left alone. The published",
      '"Speed Switches" rule reads them, so consolidating them onto Network Ports',
      "means re-pointing a live rule — a decision with a blast radius, not a",
      "migration a script should make on its own.",
    ].join("\n"),
  );

  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
