import { and, count, desc, eq, like, or } from "drizzle-orm";
import { db } from "../../../db";
import type { OrderStatus } from "../../../db/enum";
import { Invoices, Orders, type SelectOrders } from "../../../db/schema/orders";
import { Users } from "../../../db/schema/users";

// The admin's view of orders, which did not exist — orders could be placed and
// read by the customer, and nobody on this side could see them.
//
// It matters more now that payment is cash: the only way an order gets settled
// is somebody here finding it and recording the money.

export type AdminOrderRow = SelectOrders & {
  customerName: string | null;
  customerEmail: string | null;
  invoiceNumber: string | null;
};

export const listOrdersPage = async ({
  search,
  limit,
  offset,
  status,
}: {
  search?: string;
  limit: number;
  offset: number;
  status?: OrderStatus;
}): Promise<{ items: AdminOrderRow[]; total: number }> => {
  const term = search?.trim();
  const filters = [
    term
      ? or(
          like(Orders.reference, `%${term}%`),
          like(Users.fullName, `%${term}%`),
          // The payment reference, so somebody holding a receipt can find the
          // order it belongs to rather than the other way round.
          like(Orders.paymentReference, `%${term}%`),
        )
      : undefined,
    status ? eq(Orders.status, status) : undefined,
  ].flatMap((filter) => (filter ? [filter] : []));
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [items, [totals]] = await Promise.all([
    db
      .select({
        ...getOrderColumns(),
        customerName: Users.fullName,
        customerEmail: Users.email,
        invoiceNumber: Invoices.number,
      })
      .from(Orders)
      .leftJoin(Users, eq(Users.uuid, Orders.userUuid))
      .leftJoin(Invoices, eq(Invoices.orderUuid, Orders.uuid))
      .where(where)
      .orderBy(desc(Orders.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(Orders)
      .leftJoin(Users, eq(Users.uuid, Orders.userUuid))
      .where(where),
  ]);

  return { items, total: totals?.total ?? 0 };
};

const getOrderColumns = () => ({
  id: Orders.id,
  uuid: Orders.uuid,
  reference: Orders.reference,
  boqUuid: Orders.boqUuid,
  offerUuid: Orders.offerUuid,
  userUuid: Orders.userUuid,
  status: Orders.status,
  discountPercent: Orders.discountPercent,
  productTotal: Orders.productTotal,
  serviceTotal: Orders.serviceTotal,
  grandTotal: Orders.grandTotal,
  currency: Orders.currency,
  designFindings: Orders.designFindings,
  projectInputs: Orders.projectInputs,
  designOverrideReason: Orders.designOverrideReason,
  confirmedAt: Orders.confirmedAt,
  paidAt: Orders.paidAt,
  paidBy: Orders.paidBy,
  paymentReference: Orders.paymentReference,
  paymentNote: Orders.paymentNote,
  cancelledAt: Orders.cancelledAt,
  createdAt: Orders.createdAt,
  updatedAt: Orders.updatedAt,
});
