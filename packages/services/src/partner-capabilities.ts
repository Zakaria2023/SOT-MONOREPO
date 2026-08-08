import { and, asc, eq } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import {
  partnerCapabilities,
  type PartnerCapability,
} from "../../../db/enum";
import {
  PartnerCapabilityLog,
  type SelectPartnerCapabilityLog,
} from "../../../db/schema/partner-capability-log";
import {
  PartnerRequests,
  type SelectPartnerRequests,
} from "../../../db/schema/partner-requests";
import { ValidationError } from "./errors";
import {
  computePartnerDiscountPercent,
  getPartnerDiscounts,
} from "./partner-discounts";

export type { SelectPartnerCapabilityLog };

// ---------------------------------------------------------------------------
// GRANTING AND TAKING AWAY WHAT A PARTNER MAY DO.
//
// A capability is the badge: install only, install and program, pre-sell,
// post-sell, hold stock, system integrator. A partner asks for a set when they
// apply, and until now that set was frozen at approval — there was no way to
// award one later, and no way to take one back.
//
// Two things make this more than an array edit.
//
// The discount is the SUM of the percentages for every capability held. Granting
// one changes what that partner pays for everything, immediately. So each change
// records the discount it produced, and it records it as a number rather than
// leaving it to be recomputed — the matrix itself moves, and replaying today's
// percentages against last year's grant would misreport what they were charged.
//
// And the set is read and written in ONE transaction. Two administrators
// granting at the same moment would otherwise both read the old array, both
// write their own, and the second would erase the first. A JSON column cannot
// merge itself.
// ---------------------------------------------------------------------------

export type CapabilityChange = {
  partnerUuid: string;
  capability: PartnerCapability;
  actor: { name: string };
  reason: string | null;
};

const isCapability = (value: string): value is PartnerCapability =>
  (partnerCapabilities as readonly string[]).includes(value);

const held = (row: SelectPartnerRequests): PartnerCapability[] =>
  (row.capabilities ?? []).filter(isCapability);

/**
 * Award a capability to an approved partner.
 *
 * Refused for a partner who is not approved: a pending application's capability
 * list is what they ASKED for, and quietly widening it would turn a request into
 * a decision nobody made.
 */
export const grantCapability = async (
  change: CapabilityChange,
): Promise<void> => {
  if (!isCapability(change.capability)) {
    throw new ValidationError("That is not a capability.");
  }

  const discounts = await getPartnerDiscounts();

  await db.transaction(async (tx) => {
    const [partner] = await tx
      .select()
      .from(PartnerRequests)
      .where(eq(PartnerRequests.uuid, change.partnerUuid));
    if (!partner) {
      throw new ValidationError("That partner no longer exists.");
    }
    if (partner.status !== "approved") {
      throw new ValidationError(
        "Only an approved partner can be given a capability. Approve the application first.",
      );
    }

    const current = held(partner);
    if (current.includes(change.capability)) {
      throw new ValidationError("They already have that capability.");
    }

    const next = [...current, change.capability];
    const discountPercentAfter = computePartnerDiscountPercent(next, discounts);

    await tx
      .update(PartnerRequests)
      .set({ capabilities: next })
      .where(eq(PartnerRequests.uuid, change.partnerUuid));

    await tx.insert(PartnerCapabilityLog).values({
      uuid: generateUuid(),
      partnerUuid: change.partnerUuid,
      capability: change.capability,
      action: "granted",
      actorName: change.actor.name,
      reason: change.reason?.trim() || null,
      discountPercentAfter,
    });
  });
};

/**
 * Take a capability away.
 *
 * A reason is required. This narrows what a partner may sell and cuts their
 * discount in the same moment, and "why did my pricing change" is a question
 * somebody will have to answer to their face.
 *
 * The last capability may be removed. A partner with none is approved but can do
 * nothing, which is a real state — suspended without being rejected — and
 * refusing it would force whoever needs it to reject the application instead,
 * losing the history.
 */
export const revokeCapability = async (
  change: CapabilityChange,
): Promise<void> => {
  if (!isCapability(change.capability)) {
    throw new ValidationError("That is not a capability.");
  }
  const reason = change.reason?.trim() ?? "";
  if (reason === "") {
    throw new ValidationError("Taking a capability away needs a reason.");
  }

  const discounts = await getPartnerDiscounts();

  await db.transaction(async (tx) => {
    const [partner] = await tx
      .select()
      .from(PartnerRequests)
      .where(eq(PartnerRequests.uuid, change.partnerUuid));
    if (!partner) {
      throw new ValidationError("That partner no longer exists.");
    }

    const current = held(partner);
    if (!current.includes(change.capability)) {
      throw new ValidationError("They do not have that capability.");
    }

    const next = current.filter(
      (capability) => capability !== change.capability,
    );
    const discountPercentAfter = computePartnerDiscountPercent(next, discounts);

    await tx
      .update(PartnerRequests)
      .set({ capabilities: next })
      .where(eq(PartnerRequests.uuid, change.partnerUuid));

    await tx.insert(PartnerCapabilityLog).values({
      uuid: generateUuid(),
      partnerUuid: change.partnerUuid,
      capability: change.capability,
      action: "revoked",
      actorName: change.actor.name,
      reason,
      discountPercentAfter,
    });
  });
};

export type CapabilityState = {
  held: PartnerCapability[];
  // What each capability is worth today, so the screen can show what granting
  // one would cost before anybody clicks.
  discounts: Record<PartnerCapability, number>;
  discountPercent: number;
};

/** What this partner may do, and what it is worth. */
export const getCapabilityState = async (
  partnerUuid: string,
): Promise<CapabilityState | null> => {
  const [partner] = await db
    .select()
    .from(PartnerRequests)
    .where(eq(PartnerRequests.uuid, partnerUuid));
  if (!partner) {
    return null;
  }
  const discounts = await getPartnerDiscounts();
  const current = held(partner);
  return {
    held: current,
    discounts,
    discountPercent: computePartnerDiscountPercent(current, discounts),
  };
};

/** Every grant and revoke for this partner, oldest first. */
export const getCapabilityHistory = async (
  partnerUuid: string,
): Promise<SelectPartnerCapabilityLog[]> =>
  db
    .select()
    .from(PartnerCapabilityLog)
    .where(eq(PartnerCapabilityLog.partnerUuid, partnerUuid))
    .orderBy(asc(PartnerCapabilityLog.createdAt));
