import { SignIn } from "@clerk/nextjs";

const SignInPage = () => (
  <main className="flex min-h-screen items-center justify-center bg-white px-4">
    <SignIn />
  </main>
);

export default SignInPage;
