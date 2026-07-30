import { eq } from "drizzle-orm";
import { db } from ".";
import { Categories } from "./schema/categories";
import { SpecificationGroups } from "./schema/specification-groups";
import { Specifications } from "./schema/specifications";
import type { Predicate } from "./types";
import {
  createLibraryAttribute,
  deleteLibraryAttribute,
  saveAssignments,
  type AssignmentInput,
  type LibraryAttributeInput,
} from "../packages/services/src/index";

// ---------------------------------------------------------------------------
// Authoring the power-input and wireless vocabulary.
//
// WHY A SCRIPT AND NOT THE ADMIN FORM: these attributes are meant to be a
// coherent set — an input type plus the voltages each type reveals — and authored
// one at a time through the form the reveal wiring is easy to get half-right. A
// half-wired reveal shows an author a DC polarity box on an AC-only PSU, and the
// value they put there is then read by every DC rule.
//
// IDEMPOTENT. Every step looks for what it would create before creating it, so a
// re-run after a partial failure finishes the job instead of producing a second
// "DC Input Voltage" that half the catalog then answers instead of the first. That
// is the same second-spelling failure the near-duplicate check exists for, and a
// script is the easiest place to cause it.
//
// WHAT IT DELIBERATELY DOES NOT DO: it does not touch the `*Test` attributes.
// Three PUBLISHED rules read them, so they are load-bearing, not leftovers — see
// the note printed at the end.
// ---------------------------------------------------------------------------

const ACTOR = { uuid: "system-authoring", name: "Catalog authoring script" };

// Voltage is per input type because a device that takes AC and a device that takes
// 48 V DC are not the same product with a wider range. One span covering both
// would read as "36–240 V", which no rule can act on: it would approve a 48 V
// supply for an AC-only PSU.
const INPUT_TYPE = "Input Type";

type Plan = {
  attribute: LibraryAttributeInput;
  // Which categories carry it, and what reveals it. Empty means the library gains
  // the vocabulary and no category offers it yet — said out loud below rather than
  // left to be discovered.
  categories: string[];
  // The Input Type value that reveals this field, if any.
  revealedBy?: string;
};

const number = (
  label: string,
  unit: string,
  groupUuid: string,
  description: string,
  allowRange = true,
): LibraryAttributeInput => ({
  groupUuid,
  label,
  internalName: null,
  description,
  type: "number",
  unit,
  ordered: false,
  allowRange,
  audience: "everyone",
  options: [],
  optionSetUuid: null,
  groupFields: [],
});

const main = async () => {
  const groups = await db.select().from(SpecificationGroups);
  const groupId = (name: string): string => {
    const found = groups.find((group) => group.name === name);
    if (!found) {
      throw new Error(`Library group "${name}" not found`);
    }
    return found.uuid;
  };
  const power = groupId("Power");
  const wireless = groupId("Wireless");

  const categories = await db.select().from(Categories);
  const categoryId = (name: string): string => {
    const found = categories.find((category) => category.name === name);
    if (!found) {
      throw new Error(`Category "${name}" not found`);
    }
    return found.uuid;
  };
  // The two roots that carry powered equipment. Branch scope, so switches,
  // cameras, recorders and PSUs all inherit rather than each being wired by hand.
  const POWERED = [categoryId("Networking"), categoryId("Security & Automation")];

  const plans: Plan[] = [
    {
      attribute: {
        groupUuid: power,
        label: INPUT_TYPE,
        internalName: null,
        description:
          "How the device is powered. A device that accepts more than one gets more than one ticked, and each one reveals its own voltage.",
        type: "multi_select",
        unit: null,
        ordered: false,
        allowRange: false,
        audience: "everyone",
        options: [
          { label: "AC mains", rank: null },
          { label: "DC", rank: null },
          { label: "HVDC", rank: null },
          { label: "PoE", rank: null },
        ],
        optionSetUuid: null,
        groupFields: [],
      },
      categories: POWERED,
    },
    {
      attribute: number(
        "AC Input Voltage",
        "V",
        power,
        "The mains window the device accepts, low to high — 100 to 240 for a universal supply.",
      ),
      categories: POWERED,
      revealedBy: "AC mains",
    },
    {
      attribute: number(
        "Input Frequency",
        "Hz",
        power,
        "The mains frequency window, low to high — 50 to 60 for a universal supply.",
      ),
      categories: POWERED,
      revealedBy: "AC mains",
    },
    {
      attribute: number(
        "DC Input Voltage",
        "V",
        power,
        "The DC window the device accepts, low to high — 36 to 57 for a 48 V nominal device. A supply must fall WITHIN this.",
      ),
      categories: POWERED,
      revealedBy: "DC",
    },
    {
      attribute: number(
        "HVDC Input Voltage",
        "V",
        power,
        "The high-voltage DC window the device accepts, low to high — 190 to 400 typically.",
      ),
      categories: POWERED,
      revealedBy: "HVDC",
    },
    {
      attribute: {
        groupUuid: power,
        label: "DC Polarity",
        internalName: null,
        description:
          "Which rail is grounded. Getting it wrong destroys the device, so it is a value a rule can check rather than a note in a datasheet.",
        type: "single_select",
        unit: null,
        ordered: false,
        allowRange: false,
        audience: "everyone",
        options: [
          { label: "Negative ground", rank: null },
          { label: "Positive ground", rank: null },
          { label: "Floating", rank: null },
        ],
        optionSetUuid: null,
        groupFields: [],
      },
      categories: POWERED,
      revealedBy: "DC",
    },
    {
      attribute: number(
        "DC Output Voltage",
        "V",
        power,
        "What the unit SUPPLIES. A single figure, not a window — it delivers one voltage, and it has to fall within what the powered device accepts.",
        false,
      ),
      categories: [categoryId("Power supply units")],
    },
    {
      attribute: {
        groupUuid: wireless,
        label: "Wi-Fi Generation",
        internalName: null,
        description:
          "An ORDERED scale with explicit ranks, not derived from the 802.11 letters. Deriving makes the parser the source of truth and leaves ax/be ordering implicit; a stored rank says outright that Wi-Fi 6E sits above 6 and below 7.",
        type: "single_select",
        unit: null,
        ordered: true,
        allowRange: false,
        audience: "everyone",
        // Ranks spaced by 100 so a generation can be inserted between two that
        // already exist without renumbering the products holding them.
        options: [
          { label: "Wi-Fi 4 (802.11n)", rank: 400 },
          { label: "Wi-Fi 5 (802.11ac)", rank: 500 },
          { label: "Wi-Fi 6 (802.11ax)", rank: 600 },
          { label: "Wi-Fi 6E (802.11ax, 6 GHz)", rank: 650 },
          { label: "Wi-Fi 7 (802.11be)", rank: 700 },
        ],
        optionSetUuid: null,
        groupFields: [],
      },
      // Nothing in the tree is wireless yet. Assigning it to Switches would be
      // worse than leaving it unassigned: the vocabulary is correct and ready, and
      // a wrong assignment is a dropdown on the wrong products.
      categories: [],
    },
  ];

  const existing = await db.select().from(Specifications);
  const uuidByLabel = new Map(existing.map((spec) => [spec.label, spec.uuid]));

  // Created first, all of them, because a reveal condition has to name the Input
  // Type attribute by uuid and that uuid does not exist until it is written.
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

  const inputTypeUuid = uuidByLabel.get(INPUT_TYPE);
  if (!inputTypeUuid) {
    throw new Error(`"${INPUT_TYPE}" was not created`);
  }
  const [inputType] = await db
    .select()
    .from(Specifications)
    .where(eq(Specifications.uuid, inputTypeUuid));
  if (!inputType) {
    throw new Error(`"${INPUT_TYPE}" disappeared`);
  }
  const optionValue = (label: string): string => {
    const found = (inputType.options ?? []).find(
      (option) => option.label === label,
    );
    if (!found) {
      throw new Error(`"${INPUT_TYPE}" has no option "${label}"`);
    }
    // The stored VALUE, never the label — a reveal keyed on a label breaks the day
    // somebody rewords it.
    return found.value;
  };

  const revealFor = (label: string | undefined): Predicate | null =>
    label
      ? {
          op: "in",
          attr: inputTypeUuid,
          values: [optionValue(label)],
          mode: "any",
        }
      : null;

  const rowsFor = (only: (plan: Plan) => boolean): AssignmentInput[] =>
    plans.filter(only).flatMap((plan) => {
      const specificationUuid = uuidByLabel.get(plan.attribute.label);
      if (!specificationUuid) {
        return [];
      }
      return plan.categories.map((categoryUuid, index) => ({
        categoryUuid,
        specificationUuid,
        // The engine reads these; the shopper does not filter on them until
        // somebody decides that on the assignments screen.
        isFilter: false,
        isRule: true,
        scope: "branch" as const,
        showIf: revealFor(plan.revealedBy),
        audience: "everyone" as const,
        enabledValues: null,
        suppressed: false,
        order: index,
      }));
    });

  // TWO calls, and the order is a real dependency rather than tidiness. Every
  // input in a batch is validated against the model as it stands BEFORE the batch,
  // and the guard refuses an assignment revealed by an attribute the category does
  // not carry — correctly, because that is a field which could never appear. So
  // the triggers have to land, and the model be rebuilt, before anything revealed
  // by them is offered.
  const triggers = rowsFor((plan) => !plan.revealedBy);
  await saveAssignments(triggers, { actor: ACTOR });
  console.log(`\n  assigned ${triggers.length} trigger row(s)`);

  const revealed = rowsFor((plan) => Boolean(plan.revealedBy));
  await saveAssignments(revealed, { actor: ACTOR });
  console.log(`  assigned ${revealed.length} revealed row(s)`);

  // The one attribute that really is a leftover: a probe from an earlier timing
  // script. Held by nothing, assigned nowhere, read by no rule — and the service
  // refuses if any of that turns out to be untrue.
  const probe = existing.find((spec) => spec.label.startsWith("Timing Probe "));
  if (probe) {
    await deleteLibraryAttribute(probe.uuid, ACTOR);
    console.log(`  - ${probe.label} (leftover probe)`);
  }

  console.log(
    [
      "",
      "NOT DONE, deliberately: the `*Test` attributes were not removed.",
      "Three PUBLISHED rules read them — PoE (budget) reads PoE consumption Test",
      "and PoE Budget test; Speed Switches reads UpLink Speed Test; Ports type",
      "reads UpLink Type test and Downlink Type Test. They are load-bearing, and",
      "consolidating them onto the attributes the products actually answer is a",
      "decision about which side wins, with three live rules to re-point.",
    ].join("\n"),
  );

  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
