import { getUserFromRequest, unauthorized } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createBoqFromCart, getUserBoqs } from "services";

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create BOQ" },
      { status: 400 },
    );
  }
};
