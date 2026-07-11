import { getStringField, readBody } from "@/lib/helpers";
import { NextResponse } from "next/server";
import { refreshSession, toErrorResponse } from "services";

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
    const { status, message } = toErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
};
