import { getUserFromRequest, unauthorized } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getCartItemCount } from "services";

export const GET = async (request: Request) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  return NextResponse.json({ count: await getCartItemCount(user.uuid) });
};
