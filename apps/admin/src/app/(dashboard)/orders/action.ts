"use server";

import type { OrderStatus } from "@/db/enum";
import { requireAdmin } from "@/lib/server/auth";
import { adminListPage } from "@/lib/server/list";
import { revalidatePath } from "next/cache";
import {
  listOrdersPage,
  recordCashPayment,
  type AdminOrderRow,
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
