import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import type { NotificationAudience, NotificationKind } from "../../../db/enum";
import {
  Notifications,
  type SelectNotifications,
} from "../../../db/schema/notifications";

export type { SelectNotifications };

// ---------------------------------------------------------------------------
// NOTIFICATIONS, PULLED NOT PUSHED.
//
// A row is written when something happens; the client asks for its unread ones.
// No socket, no queue, no service worker — real-time delivery is a different
// problem (reconnection, fan-out, delivery guarantees) and none of it is needed
// to tell somebody their invoice is ready.
//
// The interesting decision is addressing. A notification for a customer names
// them; a notification for staff names nobody and is addressed to the AUDIENCE.
// Writing one row per admin would fan out on every event and then need
// per-admin read state for something everybody is looking at anyway — so an
// unaddressed admin row is read by all of them, and marking it read marks it
// read for the desk rather than for one person.
// ---------------------------------------------------------------------------

export type NotifyInput = {
  audience: NotificationAudience;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  // Omitted for an admin notice with no particular owner.
  recipientClerkUserId?: string | null;
};

/**
 * Record that something happened.
 *
 * Swallows its own failures, like the audit trail does and for the same reason:
 * a notification that could not be written must never be the reason a payment
 * was not recorded or an invoice was not issued. The thing that happened matters
 * more than the telling of it.
 */
export const notify = async (input: NotifyInput): Promise<void> => {
  try {
    await db.insert(Notifications).values({
      uuid: generateUuid(),
      audience: input.audience,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      recipientClerkUserId: input.recipientClerkUserId ?? null,
    });
  } catch (error) {
    console.error("notify failed:", error);
  }
};

export type Inbox = {
  items: SelectNotifications[];
  unread: number;
};

/**
 * What this person should see.
 *
 * Their own notifications plus the unaddressed ones for their audience. An admin
 * sees the desk's notices; a customer sees only their own, because there is no
 * such thing as an unaddressed customer notice.
 */
export const getInbox = async (
  audience: NotificationAudience,
  clerkUserId: string,
  limit = 30,
): Promise<Inbox> => {
  const mine = and(
    eq(Notifications.audience, audience),
    or(
      eq(Notifications.recipientClerkUserId, clerkUserId),
      // Only staff have unaddressed notices. For a client audience this branch
      // matches nothing, which is correct rather than wasteful.
      audience === "admin"
        ? isNull(Notifications.recipientClerkUserId)
        : undefined,
    ),
  );

  const [items, [counts]] = await Promise.all([
    db
      .select()
      .from(Notifications)
      .where(mine)
      .orderBy(desc(Notifications.createdAt))
      .limit(limit),
    db
      .select({ unread: sql<number>`COUNT(*)` })
      .from(Notifications)
      .where(and(mine, isNull(Notifications.readAt))),
  ]);

  return { items, unread: Number(counts?.unread ?? 0) };
};

/** Mark one read. Idempotent — a second call changes nothing. */
export const markNotificationRead = async (uuid: string): Promise<void> => {
  await db
    .update(Notifications)
    .set({ readAt: new Date() })
    .where(and(eq(Notifications.uuid, uuid), isNull(Notifications.readAt)));
};

/** Mark everything in this inbox read. */
export const markInboxRead = async (
  audience: NotificationAudience,
  clerkUserId: string,
): Promise<void> => {
  await db
    .update(Notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(Notifications.audience, audience),
        isNull(Notifications.readAt),
        or(
          eq(Notifications.recipientClerkUserId, clerkUserId),
          audience === "admin"
            ? isNull(Notifications.recipientClerkUserId)
            : undefined,
        ),
      ),
    );
};
