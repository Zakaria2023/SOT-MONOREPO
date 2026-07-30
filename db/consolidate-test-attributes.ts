import { eq, inArray } from "drizzle-orm";
import { db } from ".";
import { Categories } from "./schema/categories";
import { Relationships } from "./schema/relationships";
import { SpecificationCategories } from "./schema/specification-categories";
import { Specifications } from "./schema/specifications";
import { predicateAttributes, type Predicate } from "./types";
import {
  deleteLibraryAttribute,
  removeAssignments,
  saveAssignments,
  updateLibraryAttribute,
  updateRelationship,
  type AssignmentInput,
} from "../packages/services/src/index";

// ---------------------------------------------------------------------------
// CONSOLIDATING THE `*Test` ATTRIBUTES.
//
// The catalog had drifted into two halves that never met. The PRODUCTS answer one
// set of attributes (PoE, PoE Budget, Operating Power, Downlink Ports) and the
// RULES read another (PoE Test, PoE Budget test, PoE consumption Test) — a
// duplicate set assigned to the switch categories and answered by nothing. So
// three published rules read blanks, fifteen real values were read by nothing, and
// neither side looked broken from where it stood.
//
// WHICH SIDE WINS: the attribute the PRODUCTS answer. A rule's operand is one
// field to re-point; product values are the expensive, irreplaceable half. The
// real attributes also carry the better vocabularies — PoE Input/Output Type hold
// a ranked af/at/bt scale where "PoE Type Test" holds one option called "PoE".
//
// NOT EVERY `*Test` IS A DUPLICATE. Uplink/Downlink media type and speed have no
// counterpart anywhere in the library; they are real attributes with a working
// rule on them, and they are KEPT — renamed out of "test", with a typo and a wrong
// unit fixed. Deleting them would have taken two live rules with them.
//
// IDEMPOTENT throughout: each step checks the state it would create.
// ---------------------------------------------------------------------------

const ACTOR = { uuid: "system-authoring", name: "Catalog consolidation script" };

// The four that ARE duplicates, and what replaces each. Same type and same unit on
// both sides of every row here — checked below rather than trusted.
const REPLACEMENTS: { from: string; to: string; why: string }[] = [
  { from: "PoE Test", to: "PoE", why: "both boolean — does it do PoE at all" },
  {
    from: "PoE Budget test",
    to: "PoE Budget",
    why: "both W — what the switch can supply",
  },
  {
    from: "PoE consumption Test",
    to: "Operating Power",
    why: "both W — what the device draws",
  },
];

// Renames for the survivors. `Coper` was a typo, and GB is a STORAGE unit on an
// attribute measuring throughput — which would have made any future budget rule
// comparing it against a real Gbps figure refuse to run.
const RENAMES: {
  from: string;
  to: string;
  unit?: string;
  relabel?: Record<string, string>;
}[] = [
  {
    from: "UpLink Type test",
    to: "Uplink Media Type",
    relabel: { coper: "Copper" },
  },
  {
    from: "Downlink Type Test",
    to: "Downlink Media Type",
    relabel: { coper: "Copper" },
  },
  { from: "UpLink Speed Test", to: "Uplink Speed", unit: "Gbps" },
  { from: "Downlink speed test", to: "Downlink Speed", unit: "Gbps" },
];

const main = async () => {
  const specs = await db.select().from(Specifications);
  const byLabel = new Map(specs.map((spec) => [spec.label, spec]));
  const categories = await db.select().from(Categories);
  const categoryName = new Map(categories.map((c) => [c.uuid, c.name]));
  const links = await db.select().from(SpecificationCategories);

  // ---------------------------------------------------------------------------
  // 1. The replacements have to be like-for-like, or a rule would start reading a
  //    different quantity without anything saying so. Checked, not assumed.
  // ---------------------------------------------------------------------------
  const pairs = REPLACEMENTS.flatMap((entry) => {
    const from = byLabel.get(entry.from);
    const to = byLabel.get(entry.to);
    if (!from || !to) {
      console.log(`  = ${entry.from} → ${entry.to}: already done`);
      return [];
    }
    if (from.type !== to.type || from.unit !== to.unit) {
      throw new Error(
        `REFUSING: "${entry.from}" is ${from.type}/${from.unit} but "${entry.to}" is ${to.type}/${to.unit}. These are not the same measurement.`,
      );
    }
    console.log(`  ✓ ${entry.from} → ${entry.to} (${entry.why})`);
    return [{ from, to }];
  });

  const replacementFor = new Map(
    pairs.map(({ from, to }) => [from.uuid, to.uuid]),
  );

  // ---------------------------------------------------------------------------
  // 2. Categories carry the survivor BEFORE anything is taken away, so no category
  //    is briefly left without the attribute its products answer.
  //
  //    Each survivor inherits exactly the categories its duplicate was assigned
  //    to. Anything else would be inventing scope: the author who assigned "PoE
  //    Test" to four categories decided which four.
  // ---------------------------------------------------------------------------
  // THE REVEAL HAS TO COME ACROSS TOO, and this is the half that would have gone
  // silently wrong. On the Switch category, three of the duplicates were shown only
  // when "PoE Test" was Yes. Copying the assignment without its condition leaves
  // those fields always visible and therefore always MANDATORY — so every
  // non-PoE switch would start reporting three missing values it has no business
  // being asked for. The condition is carried, with its trigger re-pointed at the
  // survivor: "PoE Test is Yes" becomes "PoE is Yes".
  const retarget = (predicate: Predicate | null): Predicate | null => {
    if (!predicate) {
      return null;
    }
    if (predicate.op === "all" || predicate.op === "any") {
      return { ...predicate, children: predicate.children.map(retarget).filter((child): child is Predicate => child !== null) };
    }
    if (predicate.op === "not") {
      const child = retarget(predicate.child);
      return child ? { ...predicate, child } : null;
    }
    if (predicate.op === "in_category") {
      return predicate;
    }
    const next = replacementFor.get(predicate.attr);
    return next ? { ...predicate, attr: next } : predicate;
  };

  const wanted: AssignmentInput[] = [];
  const addRow = (
    specificationUuid: string,
    categoryUuid: string,
    showIf: Predicate | null,
  ): void => {
    // Deduplicated within the batch only. An EXISTING row is deliberately
    // re-saved: `saveAssignments` upserts, and a first pass of this script wrote
    // these rows before the reveal was carried across, so skipping them would
    // leave that mistake in place.
    if (
      wanted.some(
        (row) =>
          row.specificationUuid === specificationUuid &&
          row.categoryUuid === categoryUuid,
      )
    ) {
      return;
    }
    wanted.push({
      categoryUuid,
      specificationUuid,
      isFilter: false,
      isRule: true,
      scope: "branch",
      showIf,
      audience: "everyone",
      enabledValues: null,
      suppressed: false,
      order: 0,
    });
  };

  for (const { from, to } of pairs) {
    for (const link of links.filter(
      (entry) => entry.specificationUuid === from.uuid,
    )) {
      addRow(to.uuid, link.categoryUuid, retarget(link.showIf ?? null));
    }
  }

  // "PoE Type Test" held ONE option called "PoE" and was assigned to both the
  // supplying and the consuming side, so it conflated two different questions. It
  // has no single replacement: the library already holds the correct pair, and each
  // goes to the side it belongs to. Switch categories SUPPLY, device categories
  // ACCEPT — reading the wrong one is how a rule approves a bt camera on an af
  // switch.
  const typeTest = byLabel.get("PoE Type Test");
  const output = byLabel.get("PoE Output Type");
  const input = byLabel.get("PoE Input Type");
  if (typeTest && output && input) {
    for (const link of links.filter(
      (entry) => entry.specificationUuid === typeTest.uuid,
    )) {
      const name = categoryName.get(link.categoryUuid) ?? "";
      const supplies = name === "Networking" || name === "Switch";
      addRow(
        supplies ? output.uuid : input.uuid,
        link.categoryUuid,
        retarget(link.showIf ?? null),
      );
      console.log(
        `  ✓ PoE Type Test on ${name} → PoE ${supplies ? "Output" : "Input"} Type`,
      );
    }
  }

  // Held by all three switches and assigned to NOTHING, so every port count in the
  // catalog was unreadable. The same gap the completeness screen reports as
  // "answered but unused".
  const downlinkPorts = byLabel.get("Downlink Ports");
  const switchCategory = categories.find((c) => c.name === "Switch");
  const networking = categories.find((c) => c.name === "Networking");
  if (downlinkPorts && switchCategory && networking) {
    // No reveal: a switch always has ports, so there is nothing to condition it on.
    addRow(downlinkPorts.uuid, networking.uuid, null);
    addRow(downlinkPorts.uuid, switchCategory.uuid, null);
  }

  if (wanted.length > 0) {
    await saveAssignments(wanted, { actor: ACTOR });
  }
  console.log(`\n  assigned ${wanted.length} row(s) to the survivors`);

  // ---------------------------------------------------------------------------
  // 3. Re-point every rule. Before the deletions, because the delete guard refuses
  //    while a rule still references the attribute — which is the guard doing its
  //    job, not an obstacle to work around.
  // ---------------------------------------------------------------------------
  const rules = await db.select().from(Relationships);
  let repointed = 0;
  for (const rule of rules) {
    const consumer = rule.consumer ?? null;
    const provider = rule.provider ?? null;
    const swap = (operand: typeof consumer): typeof consumer => {
      if (!operand || operand.source !== "spec") {
        return operand;
      }
      const next = replacementFor.get(operand.specUuid);
      return next ? { ...operand, specUuid: next } : operand;
    };
    const nextConsumer = swap(consumer);
    const nextProvider = swap(provider);
    if (nextConsumer === consumer && nextProvider === provider) {
      continue;
    }

    await updateRelationship(
      rule.uuid,
      {
        name: rule.name,
        description: rule.description,
        family: rule.family,
        gate: rule.gate,
        comparator: rule.comparator,
        matchMode: rule.matchMode,
        headroomPercent: rule.headroomPercent,
        ratioLimit: rule.ratioLimit === null ? null : Number(rule.ratioLimit),
        allocation: rule.allocation,
        perItem: rule.perItem,
        consumer: nextConsumer,
        provider: nextProvider,
        consumerWhen: rule.consumerWhen ?? null,
        providerWhen: rule.providerWhen ?? null,
        lookup: rule.lookup ?? null,
        presence: rule.presence ?? null,
        scope: rule.scope ?? null,
      },
      ACTOR,
    );
    repointed += 1;
    console.log(`  ✓ re-pointed rule "${rule.name}"`);
  }
  console.log(`\n  re-pointed ${repointed} rule(s)`);

  // ---------------------------------------------------------------------------
  // 4. Rename the survivors. Options are passed back WITH their stored values, so
  //    relabelling "Coper" to "Copper" keeps the identity every rule compares —
  //    a re-derived value would have orphaned it.
  // ---------------------------------------------------------------------------
  for (const rename of RENAMES) {
    const spec = byLabel.get(rename.from);
    if (!spec) {
      console.log(`  = ${rename.from}: already renamed`);
      continue;
    }
    await updateLibraryAttribute(
      spec.uuid,
      {
        groupUuid: spec.groupUuid,
        label: rename.to,
        internalName: spec.internalName,
        description: spec.description,
        type: spec.type,
        unit: rename.unit ?? spec.unit,
        ordered: spec.ordered,
        allowRange: spec.allowRange,
        audience: spec.audience,
        options: (spec.options ?? []).map((option) => ({
          value: option.value,
          label: rename.relabel?.[option.value] ?? option.label,
          rank: option.rank,
        })),
        optionSetUuid: spec.optionSetUuid,
        groupFields: (spec.groupFields ?? []).map((field) => ({
          key: field.key,
          label: field.label,
          kind: field.kind,
          unit: field.unit,
          ordered: field.ordered,
          options: field.options.map((option) => ({
            value: option.value,
            label: option.label,
            rank: option.rank,
          })),
          optionSetUuid: field.optionSetUuid ?? null,
        })),
      },
      ACTOR,
    );
    console.log(
      `  ✓ ${rename.from} → ${rename.to}${rename.unit ? ` (${spec.unit} → ${rename.unit})` : ""}`,
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Unlink, then delete. Both through the services, so every guard still fires —
  //    the delete refuses if anything at all still points at the attribute, which
  //    is the last check that this consolidation actually finished.
  // ---------------------------------------------------------------------------
  const doomed = [...pairs.map(({ from }) => from), typeTest].filter(
    (spec): spec is NonNullable<typeof typeTest> => Boolean(spec),
  );

  // A TRIGGER GOES LAST. `removeAssignments` refuses while another assignment on
  // the same category is revealed by the attribute — correctly, because the
  // dependent field would be left watching something nobody can set and would be
  // permanently hidden with nothing to say why. Since the dependents are on this
  // very list, the fix is ordering rather than force: unlink what is revealed
  // first, and the trigger stops being one.
  const isTrigger = new Set(
    links.flatMap((link) => predicateAttributes(link.showIf ?? null)),
  );
  const ordered = [
    ...doomed.filter((spec) => !isTrigger.has(spec.uuid)),
    ...doomed.filter((spec) => isTrigger.has(spec.uuid)),
  ];

  for (const spec of ordered) {
    const on = links
      .filter((link) => link.specificationUuid === spec.uuid)
      .map((link) => link.categoryUuid);
    if (on.length > 0) {
      await removeAssignments(spec.uuid, on, ACTOR);
    }
    await deleteLibraryAttribute(spec.uuid, ACTOR);
    console.log(`  - ${spec.label} (unlinked from ${on.length}, deleted)`);
  }

  const left = await db
    .select({ label: Specifications.label })
    .from(Specifications)
    .where(
      inArray(
        Specifications.label,
        REPLACEMENTS.map((entry) => entry.from).concat("PoE Type Test"),
      ),
    );
  console.log(
    `\n  duplicates remaining: ${left.length === 0 ? "none" : left.map((s) => s.label).join(", ")}`,
  );

  const [poe] = await db
    .select()
    .from(Relationships)
    .where(eq(Relationships.name, "PoE"));
  if (poe && poe.headroomPercent < 50) {
    console.log(
      `\n  NOTE: the "PoE" rule has headroomPercent=${poe.headroomPercent}, which means only ${poe.headroomPercent}% of a switch's budget is usable. Left exactly as the author set it — but on real data that now reads as a blocker, and 80 is the usual intent.`,
    );
  }

  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
