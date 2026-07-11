import { getUserFromRequest, unauthorized } from "@/lib/helpers";
import { NextResponse } from "next/server";
import { createBoqFromCart, getUserBoqs, toErrorResponse } from "services";

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

  try {
    const boq = await createBoqFromCart(user.uuid, categoryUuid);
    return NextResponse.json(boq, { status: 201 });
  } catch (error) {
    const { status, message } = toErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
};
