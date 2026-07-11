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

// Checkout: turn the caller's cart into a new draft BOQ.
export const POST = async (request: Request) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  try {
    const boq = await createBoqFromCart(user.uuid);
    return NextResponse.json(boq, { status: 201 });
  } catch (error) {
    const { status, message } = toErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
};
