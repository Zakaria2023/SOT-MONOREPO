import { and, eq, sql } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import { partnerCapabilities, type PartnerCapability } from "../../../db/enum";
import { PartnerDiscounts } from "../../../db/schema/partner-discounts";
import { PartnerRequests } from "../../../db/schema/partner-requests";

// A percentage per capability. Missing capabilities default to 0.
export type PartnerDiscountMap = Record<PartnerCapability, number>;

const emptyMap = (): PartnerDiscountMap =>
  Object.fromEntries(
    partnerCapabilities.map((capability) => [capability, 0]),
  ) as PartnerDiscountMap;

const clampPercent = (value: number): number =>
  Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));

/** The full discount matrix — every capability, defaulting to 0 when unset. */
export const getPartnerDiscounts = async (): Promise<PartnerDiscountMap> => {
  try {
    const rows = await db.select().from(PartnerDiscounts);
    const byCapability = new Map(
      rows.map((row) => [row.capability, row.percent]),
    );
    const map = emptyMap();
    for (const capability of partnerCapabilities) {
      map[capability] = byCapability.get(capability) ?? 0;
    }
    return map;
  } catch (error) {
    console.error("getPartnerDiscounts failed:", error);
    throw new Error("Failed to fetch partner discounts", { cause: error });
  }
};

/** Upsert every capability's percentage in a single statement. */
export const setPartnerDiscounts = async (
  map: PartnerDiscountMap,
): Promise<void> => {
  const rows = partnerCapabilities.map((capability) => ({
    uuid: generateUuid(),
    capability,
    percent: clampPercent(map[capability] ?? 0),
  }));

  // Each row needs its own percent on conflict, so the update branch is a CASE
  // over the capability rather than a single shared value. Spelling it out this
  // way also avoids MySQL's deprecated VALUES() function.
  await db
    .insert(PartnerDiscounts)
    .values(rows)
    .onDuplicateKeyUpdate({
      set: {
        percent: sql`case ${PartnerDiscounts.capability} ${sql.join(
          rows.map((row) => sql`when ${row.capability} then ${row.percent}`),
          sql` `,
        )} end`,
      },
    });
};

/**
 * A partner's total discount percentage — the sum of the percentages for every
 * capability they hold, capped at 100. Stacking is additive (stock 20 +
 * pre_sell 10 = 30).
 */
export const computePartnerDiscountPercent = (
  capabilities: string[],
  discounts: PartnerDiscountMap,
): number => {
  const total = capabilities.reduce((sum, capability) => {
    const percent = discounts[capability as PartnerCapability];
    return sum + (typeof percent === "number" ? percent : 0);
  }, 0);
  return Math.min(100, Math.max(0, total));
};

export type ViewerPartnerPricing = {
  isPartner: boolean;
  discountPercent: number;
  // What they are approved to DO, not only what it is worth. The cart needs it
  // to decide where a basket may go — buying stock requires the capability that
  // says they may hold it — and returning the percentage without the reasons
  // behind it forced every caller to fetch the partner row a second time.
  capabilities: PartnerCapability[];
};

/**
 * Resolve the shopping discount for a Clerk user: their stacked partner
 * discount if they're an approved partner, otherwise none. Used by the client
 * to price the catalog for the signed-in viewer.
 */
export const getPartnerPricingForClerkUser = async (
  clerkUserId: string | null | undefined,
): Promise<ViewerPartnerPricing> => {
  if (!clerkUserId) {
    return { isPartner: false, discountPercent: 0, capabilities: [] };
  }

  const [row] = await db
    .select({ capabilities: PartnerRequests.capabilities })
    .from(PartnerRequests)
    .where(
      and(
        eq(PartnerRequests.approvedClerkUserId, clerkUserId),
        eq(PartnerRequests.status, "approved"),
      ),
    );

  if (!row) {
    return { isPartner: false, discountPercent: 0, capabilities: [] };
  }

  const held = (row.capabilities ?? []).filter((capability): capability is PartnerCapability =>
    (partnerCapabilities as readonly string[]).includes(capability),
  );

  const discounts = await getPartnerDiscounts();
  return {
    isPartner: true,
    discountPercent: computePartnerDiscountPercent(held, discounts),
    capabilities: held,
  };
};
