import { getStringField, readBody } from "@/lib/helpers";
import { NextResponse } from "next/server";
import { refreshSession } from "services";

export const POST = async (request: Request) => {
  const refreshToken = getStringField(await readBody(request), "refreshToken");
  if (!refreshToken) {
    return NextResponse.json(
      { error: "A refresh token is required." },
      { status: 400 },
    );
  }

  try {
    const result = await refreshSession(refreshToken);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid or expired session",
      },
      { status: 401 },
    );
  }
};
