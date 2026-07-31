import { getUserFromRequest, unauthorized } from "@/lib/helpers";
import { NextResponse } from "next/server";
import {
  createBoqFromCart,
  getUserBoqs,
  isProfileComplete,
  toErrorResponse,
} from "services";
import { projectAnswersSchema } from "validators";

export const GET = async (request: Request) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  return NextResponse.json(await getUserBoqs(user.uuid));
};

// Checkout: turn one solution (category) in the caller's cart into a draft BOQ.
export const POST = async (request: Request) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  const body: unknown = await request.json().catch(() => null);
  const categoryUuid =
    typeof body === "object" && body !== null && "categoryUuid" in body
      ? (body as { categoryUuid: unknown }).categoryUuid
      : null;
  if (typeof categoryUuid !== "string" || categoryUuid.length === 0) {
    return NextResponse.json(
      { error: "categoryUuid is required" },
      { status: 400 },
    );
  }

  // The same guard the web checkout applies before it will send a BOQ. Enforced
  // on this transport too, or the profile requirement is a web convention the
  // mobile app walks straight past.
  if (!isProfileComplete(user)) {
    return NextResponse.json(
      { error: "Complete your profile before sending a BOQ", code: "profile" },
      { status: 409 },
    );
  }

  // The buyer's answers to the design check's project questions, carried onto the
  // BOQ so the pre-seller validates the design the buyer was actually shown.
  const answers = projectAnswersSchema.safeParse(
    (body as { projectInputs?: unknown }).projectInputs ?? {},
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
    const boq = await createBoqFromCart(user.uuid, categoryUuid, answers.data);
    return NextResponse.json(boq, { status: 201 });
  } catch (error) {
    const { status, message } = toErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
};
