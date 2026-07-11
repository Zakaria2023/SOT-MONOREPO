import { readBody } from "@/lib/helpers";
import { NextResponse } from "next/server";
import { registerUser, toErrorResponse } from "services";
import { registerSchema } from "validators";

export const POST = async (request: Request) => {
  const parsed = registerSchema.safeParse(await readBody(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form and try again." },
      { status: 400 },
    );
  }

  // confirmPassword is validation-only — never sent to the service.
  const { confirmPassword: _confirmPassword, ...input } = parsed.data;
  void _confirmPassword;

  try {
    const result = await registerUser(input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const { status, message } = toErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
};
