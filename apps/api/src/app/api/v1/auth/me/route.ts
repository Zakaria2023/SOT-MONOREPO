import { getUserFromRequest, unauthorized } from "@/lib/auth";
import { NextResponse } from "next/server";

export const GET = async (request: Request) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized();
  }

  return NextResponse.json(user);
};
