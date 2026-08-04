import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Slot } from "expo-router";

/**
 * The mirror of the guard in (tabs)/_layout: that one keeps a signed-out user out
 * of the app, this one keeps a signed-in user out of sign-in.
 *
 * Without it a session that already exists lands on the sign-in screen and stays
 * there — Clerk refuses to create a second session and answers "Session already
 * exists", which reads as a broken login rather than as being already logged in.
 *
 * <Redirect> rather than an effect, for the same reason as the other guard: an
 * imperative navigate from the root layout runs before the navigator is mounted.
 */
const AuthLayout = () => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  return <Slot />;
};

export default AuthLayout;
