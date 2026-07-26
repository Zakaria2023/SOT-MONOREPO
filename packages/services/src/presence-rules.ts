import { eq, inArray } from "drizzle-orm";
import { db } from "../../../db";
import { BoqItems } from "../../../db/schema/boqs";
import { Categories } from "../../../db/schema/categories";
import { Products } from "../../../db/schema/products";
import type { SelectionInput } from "./rule-engine";
import {
  evaluatePresence,
  gateDecision,
  type PresenceAttrValue,
  type PresenceBoq,
  type PresenceFinding,
  type PresenceGateDecision,
  type PresenceItem,
  type PresenceRule,
} from "./presence-engine";
import { PRESENCE_RULES } from "./presence-rules-data";

export type BoqPresenceResult = {
  findings: PresenceFinding[];
  gate: PresenceGateDecision;
};

/**
 * The active presence rules. Loaded dynamically at runtime from code
 * (rules-as-data) — no seed, no migration. Kept as a function so an
 * admin-managed override store can be layered in later without changing callers.
 */
export const getPresenceRules = (): PresenceRule[] => PRESENCE_RULES;

// ---------------------------------------------------------------------------
// Device classifier — the one project-specific piece. It maps a BOQ line's
// category + technical attributes to the `kind` classes the rules key off
// (camera, recorder, poe_source, …). Keyword-based so it keeps working as the
// (admin-built, unseeded) catalog grows; tune the keywords as new types arrive.
// ---------------------------------------------------------------------------

const catHas = (category: string, ...keywords: string[]): boolean =>
  keywords.some((keyword) => category.includes(keyword));

export const classifyPresenceAttributes = (
  categoryName: string | null,
  technicalAttributes: Record<string, string>,
): Record<string, PresenceAttrValue> => {
  const category = (categoryName ?? "").toLowerCase();
  const values = Object.values(technicalAttributes).map((value) =>
    value.toLowerCase(),
  );
  const valuesInclude = (needle: string): boolean =>
    values.some((value) => value.includes(needle));

  const kind = new Set<string>();
  const powerSupplyMode = new Set<string>();
  if (valuesInclude("poe")) {
    powerSupplyMode.add("poe");
  }
  if (valuesInclude("dc")) {
    powerSupplyMode.add("dc");
  }
  if (valuesInclude("ac")) {
    powerSupplyMode.add("ac");
  }
  if (valuesInclude("battery")) {
    powerSupplyMode.add("battery");
  }

  const hasPoe = powerSupplyMode.has("poe") || valuesInclude("poe");

  if (catHas(category, "camera")) {
    kind.add("camera");
    kind.add("wired_device");
    if (hasPoe) {
      kind.add("poe_camera");
    }
  }
  if (catHas(category, "recorder", "nvr", "dvr")) {
    kind.add("recorder");
    kind.add("wired_device");
    if (hasPoe) {
      kind.add("poe_source");
    }
  }
  if (catHas(category, "switch")) {
    kind.add("wired_device");
    if (hasPoe) {
      kind.add("poe_source");
    }
  }
  if (catHas(category, "injector")) {
    kind.add("poe_source");
  }
  if (catHas(category, "speaker")) {
    kind.add("speaker");
    if (!category.includes("active") && !category.includes("powered")) {
      kind.add("passive_speaker");
    }
  }
  if (catHas(category, "amplifier", " amp")) {
    kind.add("amplifier");
    kind.add("power_amp");
  }
  if (catHas(category, "pre-amp", "preamp", "streamer")) {
    kind.add("preamp");
  }
  if (catHas(category, "pbx", "call platform")) {
    kind.add("pbx");
  }
  if (catHas(category, "sip", "ip phone", "desk phone", "endpoint")) {
    kind.add("sip_phone");
    kind.add("wired_device");
  }
  if (catHas(category, "analog phone")) {
    kind.add("analog_phone");
  }
  if (catHas(category, "gateway", "ata")) {
    if (valuesInclude("fxs")) {
      kind.add("fxs_gateway");
    }
    if (valuesInclude("fxo")) {
      kind.add("fxo_gateway");
    }
  }
  if (catHas(category, "rack", "enclosure", "cabinet")) {
    kind.add("rack");
  }
  if (catHas(category, "reader")) {
    kind.add("reader");
  }
  if (catHas(category, "controller")) {
    kind.add("access_controller");
  }
  if (catHas(category, "lock", "strike", "maglock")) {
    kind.add("lock");
  }
  if (catHas(category, "exit")) {
    kind.add("exit_device");
  }
  if (catHas(category, "cabl", "patch panel")) {
    kind.add("cabling");
  }
  if (catHas(category, "psu", "power supply", "adapter")) {
    kind.add("psu");
  }
  if (catHas(category, "fibre", "fiber")) {
    kind.add("fibre_link");
  }
  if (catHas(category, "sfp", "transceiver")) {
    kind.add("sfp_module");
  }

  const attributes: Record<string, PresenceAttrValue> = { kind: [...kind] };
  if (powerSupplyMode.size > 0) {
    attributes.power_supply_mode = [...powerSupplyMode];
  }
  return attributes;
};

/**
 * Run the presence engine over a BOQ's product lines. `choices` are the
 * project escape hatches (cloud_recording, sip_trunk_or_cloud, …); they'll come
 * from the Solution Builder questionnaire once it exists — default none.
 */
export const checkBoqPresence = async (
  boqUuid: string,
  choices: Record<string, boolean> = {},
): Promise<BoqPresenceResult> => {
  const rows = await db
    .select({
      productUuid: BoqItems.productUuid,
      name: BoqItems.name,
      quantity: BoqItems.quantity,
      categoryName: BoqItems.categoryName,
      technicalAttributes: Products.technicalAttributes,
    })
    .from(BoqItems)
    .leftJoin(Products, eq(BoqItems.productUuid, Products.uuid))
    .where(eq(BoqItems.boqUuid, boqUuid));

  const items: PresenceItem[] = rows
    .filter((row) => row.productUuid)
    .map((row) => ({
      productUuid: row.productUuid ?? undefined,
      name: row.name,
      quantity: row.quantity,
      attributes: classifyPresenceAttributes(
        row.categoryName,
        row.technicalAttributes ?? {},
      ),
    }));

  const boq: PresenceBoq = { items, choices };
  const findings = evaluatePresence(boq, getPresenceRules());
  return { findings, gate: gateDecision(findings) };
};

/**
 * The same requires-companion check over a raw cart selection (product uuids +
 * quantities), so the storefront cart can warn "camera with no recorder" before
 * anything becomes a BOQ. Mirrors checkBoqPresence but resolves attributes from
 * live products rather than snapshotted BOQ lines.
 */
export const checkCartPresence = async (
  selection: SelectionInput[],
  choices: Record<string, boolean> = {},
): Promise<BoqPresenceResult> => {
  const active = selection.filter((line) => line.quantity > 0);
  if (active.length === 0) {
    return { findings: [], gate: gateDecision([]) };
  }

  const rows = await db
    .select({
      uuid: Products.uuid,
      name: Products.name,
      categoryName: Categories.name,
      technicalAttributes: Products.technicalAttributes,
    })
    .from(Products)
    .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid))
    .where(
      inArray(
        Products.uuid,
        active.map((line) => line.productUuid),
      ),
    );
  const byUuid = new Map(rows.map((row) => [row.uuid, row]));

  const items: PresenceItem[] = active.flatMap((line) => {
    const product = byUuid.get(line.productUuid);
    if (!product) {
      return [];
    }
    return [
      {
        productUuid: product.uuid,
        name: product.name,
        quantity: line.quantity,
        attributes: classifyPresenceAttributes(
          product.categoryName,
          product.technicalAttributes ?? {},
        ),
      },
    ];
  });

  const findings = evaluatePresence({ items, choices }, getPresenceRules());
  return { findings, gate: gateDecision(findings) };
};
