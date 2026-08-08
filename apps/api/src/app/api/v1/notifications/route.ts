import { getUserFromRequest, unauthorized } from "@/lib/helpers";
import { NextResponse } from "next/server";
import { getInbox, markInboxRead } from "services";

/**
 * This caller's notifications.
 *
 * POLLED, not pushed. There is no socket and no queue — the client asks, and a
 * row written when something happened comes back. Real-time delivery is a
 * different problem (reconnection, fan-out, delivery guarantees) and none of it
 * is needed to tell somebody their invoice is ready.
 *
 * Always the `client` audience here: this API exists for the customer-facing
 * apps, and staff notices are read through the admin, which reaches the service
 * directly. An endpoint that could return either on a parameter would be one
 * forged parameter away from showing a customer the desk's queue.
 */
export const GET = async (request: Request) => {
  const user = await getUserFromRequest(request);
  if (!user?.clerkUserId) {
    return unauthorized();
  }

  return NextResponse.json(await getInbox("client", user.clerkUserId));
};

/** Mark the whole inbox read. */
export const POST = async (request: Request) => {
  const user = await getUserFromRequest(request);
  if (!user?.clerkUserId) {
    return unauthorized();
  }

  await markInboxRead("client", user.clerkUserId);
  return NextResponse.json({ ok: true });
};
