import { getStringField, readBody } from "@/lib/request";
import { NextResponse } from "next/server";
import { logoutUser } from "services";

export const POST = async (request: Request) => {
  const refreshToken = getStringField(await readBody(request), "refreshToken");
  if (!refreshToken) {
    return NextResponse.json(
      { error: "A refresh token is required." },
      { status: 400 },
    );
  }

  await logoutUser(refreshToken);
  return new NextResponse(null, { status: 204 });
};
