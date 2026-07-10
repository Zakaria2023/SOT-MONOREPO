import { readBody } from "@/lib/helpers";
import { NextResponse } from "next/server";
import { loginUser } from "services";
import { loginSchema } from "validators";

export const POST = async (request: Request) => {
  const parsed = loginSchema.safeParse(await readBody(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form and try again." },
      { status: 400 },
    );
  }

  try {
    const result = await loginUser({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sign in." },
      { status: 401 },
    );
  }
};
