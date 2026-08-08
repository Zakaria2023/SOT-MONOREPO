"use server";

import type { OrderStatus } from "@/db/enum";
import { requireAdmin } from "@/lib/server/auth";
import { adminListPage } from "@/lib/server/list";
import { revalidatePath } from "next/cache";
import {
  applyOrderChange,
  listOrderChanges,
  listOrdersPage,
  proposeOrderChange,
  recordCashPayment,
  rejectOrderChange,
  type AdminOrderRow,
  type ChangeVerdict,
  type SelectOrderChanges,
} from "services";
import { fail, type ActionResult } from "utils";
import type { ListParams, PaginatedResult } from "utils";

export const getOrdersPage = async (
  params: ListParams & { status?: OrderStatus } = {},
): Promise<PaginatedResult<AdminOrderRow>> =>
  adminListPage(params, ({ search, limit, offset }) =>
    listOrdersPage({ search, limit, offset, status: params.status }),
  );

/**
 * Record cash received against an order.
 *
 * The only way an order gets settled now. There is no gateway and no callback —
 * the money is handed to a person, and this is that person putting it on the
 * record. Which is why it takes their name from the session rather than a form
 * field: whoever is signed in is who received it.
 *
 * The reference is required. A payment recorded against nothing cannot be
 * reconciled against a till or a deposit, and "paid" then means only that
 * somebody clicked.
 */
export const recordCashAction = async (
  orderUuid: string,
  reference: string,
  note: string | null,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await recordCashPayment(orderUuid, {
      by: actor.name,
      reference,
      note,
    });
    revalidatePath("/orders");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to record that payment");
  }
};

// ---------------------------------------------------------------------------
// A13 — change orders
// ---------------------------------------------------------------------------

export const listOrderChangesAction = async (
  orderUuid: string,
): Promise<SelectOrderChanges[]> => {
  await requireAdmin();
  return listOrderChanges(orderUuid);
};

/**
 * Propose a change and show what the engine makes of it.
 *
 * Recorded even when the engine refuses, because a refused proposal is the
 * evidence that stops the same change being suggested again next week.
 */
export const proposeChangeAction = async (
  orderUuid: string,
  lines: { productUuid: string; quantity: number }[],
  reason: string,
): Promise<ActionResult & { verdict?: ChangeVerdict }> => {
  const { actor } = await requireAdmin();
  try {
    const verdict = await proposeOrderChange({
      orderUuid,
      lines,
      reason,
      proposedBy: actor.name,
    });
    revalidatePath("/orders");
    return { success: true, verdict };
  } catch (error) {
    return fail(error, "Failed to propose that change");
  }
};

/**
 * Apply it — which re-runs the gate at THIS moment, not the one from proposal.
 *
 * An override needs a reason, exactly as the checkout gate does. Without one a
 * change the engine refuses stays refused.
 */
export const applyChangeAction = async (
  changeUuid: string,
  overrideReason?: string,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await applyOrderChange({
      changeUuid,
      decidedBy: actor.name,
      override: overrideReason?.trim()
        ? { allowed: true, reason: overrideReason }
        : undefined,
    });
    revalidatePath("/orders");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to apply that change");
  }
};

export const rejectChangeAction = async (
  changeUuid: string,
  note: string,
): Promise<ActionResult> => {
  const { actor } = await requireAdmin();
  try {
    await rejectOrderChange(changeUuid, actor.name, note);
    revalidatePath("/orders");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to turn that change down");
  }
};
