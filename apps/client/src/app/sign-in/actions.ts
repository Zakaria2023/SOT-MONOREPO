"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  loginUser,
  type AuthResult,
} from "services";
import { loginSchema, type LoginInput } from "validators";

export type LoginActionState = {
  error?: string;
};

export const signIn = async (
  _prevState: LoginActionState,
  input: LoginInput,
): Promise<LoginActionState> => {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please check the form and try again." };
  }

  let session: AuthResult;
  try {
    session = await loginUser({
      email: parsed.data.email,
      password: parsed.data.password,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to sign in.",
    };
  }

  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  // When "keep me signed in" is off, use session cookies (cleared on close).
  const persist = parsed.data.keepSignedIn ?? false;

  cookieStore.set("access_token", session.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    ...(persist ? { maxAge: ACCESS_TOKEN_TTL_SECONDS } : {}),
  });
  cookieStore.set("refresh_token", session.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    ...(persist ? { maxAge: REFRESH_TOKEN_TTL_SECONDS } : {}),
  });

  redirect("/");
};
