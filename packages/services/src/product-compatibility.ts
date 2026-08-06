import type { CompatibilityVerdict } from "../../../db/enum";

// ---------------------------------------------------------------------------
// THE EXCEPTION LIST — pairs the derived rules cannot reach.
//
// Pure, so it is testable without a connection, and so the reduction below can
// be reasoned about on its own. Loading is `catalog-model`'s job, like every
// other thing the engine reads.
//
// The shape of the whole feature, and the reason it is small on purpose:
//
// Compatibility is DERIVED. A rule reads the attributes both sides carry, so a
// new SKU joins every existing rule the moment its values are filled in, and a
// second vendor with the same radio just works. That is the property that lets a
// catalogue of 339 products be maintained by people rather than by everyone
// remembering everything. Naming products in a rule throws it away.
//
// The Ajax matrix is 1,141 pairs, and almost all of them are already implied:
// all 23 Fibra devices map to exactly the four Fibra-capable hubs, which is what
// `net.link_technology` says; the universal Jeweller devices map to every
// Jeweller hub, which is the same. Importing all 1,141 as rows would be
// recording the answer instead of the reason, and then the first product added
// afterwards would be compatible with nothing until somebody typed 14 more rows.
//
// What genuinely cannot be derived is a short list: an accessory moulded to fit
// one host, a physical fit nothing measures, a bundle. Those live here.
// ---------------------------------------------------------------------------

// One vendor-authored claim about two specific products, as the engine reads it.
export type CompatibilityPair = {
  productUuidA: string;
  productUuidB: string;
  verdict: CompatibilityVerdict;
  note: string | null;
  source: string;
};

/**
 * The pairs, indexed for lookup in both directions.
 *
 * BOTH DIRECTIONS, from rows stored in one. The stored row is directional
 * because "a battery fits a hub" is not the same sentence as "a hub fits a
 * battery" — but a basket is a bag with no direction in it, and asking the index
 * to be consulted twice at every call site is asking for the day somebody
 * consults it once.
 */
export type CompatibilityIndex = {
  // Keyed "a|b" AND "b|a", both pointing at the same row.
  byPair: Map<string, CompatibilityPair>;
  // Every product named by any pair, so the engine can skip the whole check for
  // a basket that touches none of them — which is almost every basket.
  participants: Set<string>;
};

const pairKey = (a: string, b: string): string => `${a}|${b}`;

export const indexCompatibility = (
  pairs: CompatibilityPair[],
): CompatibilityIndex => {
  const byPair = new Map<string, CompatibilityPair>();
  const participants = new Set<string>();
  for (const pair of pairs) {
    byPair.set(pairKey(pair.productUuidA, pair.productUuidB), pair);
    byPair.set(pairKey(pair.productUuidB, pair.productUuidA), pair);
    participants.add(pair.productUuidA);
    participants.add(pair.productUuidB);
  }
  return { byPair, participants };
};

/**
 * What the vendor says about two products, or null when it has said nothing.
 *
 * NULL IS THE COMMON ANSWER and it means "no exception recorded", never "these
 * are incompatible". Reading silence as a refusal would turn an exception list
 * into a whitelist: every pair not in it would block, and a catalogue of 339
 * products would need 100,000 rows before anything could be bought.
 */
export const vendorVerdict = (
  index: CompatibilityIndex,
  a: string,
  b: string,
): CompatibilityPair | null => index.byPair.get(pairKey(a, b)) ?? null;

// A pair in a basket the vendor has explicitly ruled out.
export type IncompatibleFinding = {
  productUuidA: string;
  productUuidB: string;
  note: string | null;
  source: string;
};

/**
 * Every explicitly-incompatible pair in a selection.
 *
 * ONLY `incompatible` is reported. A `compatible` row is a permission — it
 * exists to let a pair through that the derived rules would have refused — and a
 * permission has nothing to say about a basket on its own.
 *
 * Each unordered pair is examined ONCE. Walking the full N² would report the
 * same clash twice under two names, and a buyer told the same thing twice about
 * one problem starts discounting the list.
 */
export const incompatiblePairs = (
  index: CompatibilityIndex,
  productUuids: string[],
): IncompatibleFinding[] => {
  // Almost every basket touches nothing in the exception list. Leaving early
  // keeps this off the critical path of a check that already runs on every cart
  // render.
  const involved = productUuids.filter((uuid) => index.participants.has(uuid));
  if (involved.length < 2) {
    return [];
  }

  const findings: IncompatibleFinding[] = [];
  for (let i = 0; i < involved.length; i += 1) {
    for (let j = i + 1; j < involved.length; j += 1) {
      const a = involved[i];
      const b = involved[j];
      if (a === undefined || b === undefined) {
        continue;
      }
      const pair = vendorVerdict(index, a, b);
      if (pair?.verdict !== "incompatible") {
        continue;
      }
      findings.push({
        // Reported in the STORED direction, not the basket's, so the message
        // reads the way the vendor wrote it — "the antenna does not fit the hub"
        // rather than whichever line happened to be added first.
        productUuidA: pair.productUuidA,
        productUuidB: pair.productUuidB,
        note: pair.note,
        source: pair.source,
      });
    }
  }
  return findings;
};

/**
 * Whether a pair carries an explicit permission.
 *
 * This is the half that makes the list worth having in both directions. A rule
 * derived from attributes refuses the ExternalAntenna on five of its six hubs,
 * because no attribute records which mouldings it fits — and the answer to a
 * false block is not to weaken the rule for everyone, it is to record the
 * exception on the pair it applies to.
 */
export const isVendorApproved = (
  index: CompatibilityIndex,
  a: string,
  b: string,
): boolean => vendorVerdict(index, a, b)?.verdict === "compatible";
