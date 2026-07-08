"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  registerUser,
  type AuthResult,
} from "services";
import { registerSchema, type RegisterInput } from "validators";

export type RegisterActionState = {
  error?: string;
};

export const signUp = async (
  _prevState: RegisterActionState,
  input: RegisterInput,
): Promise<RegisterActionState> => {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please check the form and try again." };
  }

  // confirmPassword is validation-only — never sent to the service.
  const { confirmPassword: _confirmPassword, ...userInput } = parsed.data;
  void _confirmPassword;

  let session: AuthResult;
  try {
    session = await registerUser(userInput);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create account.",
    };
  }

  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set("access_token", session.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  cookieStore.set("refresh_token", session.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });

  redirect("/");
};
