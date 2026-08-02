import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import type { ReactNode } from "react";

// The page itself is a client component and so cannot export metadata. This
// layout exists only to attach the noindex — an OAuth landing strip has nothing
// to index and would otherwise inherit the site defaults.
export const metadata: Metadata = pageMetadata({
  title: "Signing you in",
  description: "Completing sign-in.",
  path: "/sso-callback",
  noIndex: true,
});

type Props = {
  children: ReactNode;
};

const SsoCallbackLayout = ({ children }: Props) => children;

export default SsoCallbackLayout;
