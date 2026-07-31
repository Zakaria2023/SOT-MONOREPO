import { getUserFromRequest, readBody, unauthorized } from "@/lib/helpers";
import { NextResponse } from "next/server";
import {
  createOrderFromCart,
  getPartnerPricingForClerkUser,
  getUserOrders,
  isProfileComplete,
  toErrorResponse,
} from "services";
import { projectAnswersSchema } from "validators";

export const GET = async (request: Request) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  return NextResponse.json(await getUserOrders(user.uuid));
};

/**
 * Direct checkout: turn the standalone product lines in the caller's cart into an
 * order. Solutions go through /boqs instead.
 *
 * The mobile app had no way to place an order at all — its cart ran the design
 * check and then offered a button that reloaded the list. So the whole purchase
 * gate existed on the server with only one transport able to reach it, which is
 * the drift this API exists to prevent.
 *
 * The gate itself lives inside `createOrderFromCart`, not here: a check that only
 * runs in a route handler is bypassed by the next handler somebody adds.
 */
export const POST = async (request: Request) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  // Same guard as the web checkout — a `code` so the app can route the buyer to
  // the profile form rather than only showing the sentence.
  if (!isProfileComplete(user)) {
    return NextResponse.json(
      { error: "Complete your profile before ordering", code: "profile" },
      { status: 409 },
    );
  }

  const body = await readBody(request);
  // An order with no answers is normal (most baskets ask nothing), so a missing
  // body is fine — but a malformed answer set is reported rather than dropped:
  // the gate would otherwise refuse the order over a question the buyer answered.
  const answers = projectAnswersSchema.safeParse(
    body && typeof body === "object" && "projectInputs" in body
      ? (body as { projectInputs: unknown }).projectInputs
      : {},
  );
  if (!answers.success) {
    return NextResponse.json(
      {
        error:
          "`projectInputs` must map a project question's uuid to a number or a boolean",
      },
      { status: 400 },
    );
  }

  try {
    const { discountPercent } = await getPartnerPricingForClerkUser(
      user.clerkUserId,
    );
    const order = await createOrderFromCart({
      userUuid: user.uuid,
      discountPercent,
      variables: answers.data,
    });
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    // A blocked design comes back as a 400 through the shared mapper, carrying the
    // engine's own sentence — the app shows the buyer why, not "order failed".
    const { status, message } = toErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
};
