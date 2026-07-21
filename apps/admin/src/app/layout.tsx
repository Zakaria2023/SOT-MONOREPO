import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stratum Admin",
  description: "Stratum admin dashboard",
};

// Always render against live data — never a build-time static snapshot.
export const dynamic = "force-dynamic";

type Props = {
  children: ReactNode;
};

const RootLayout = ({ children }: Props) => (
  <ClerkProvider>
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col text-ink font-sans">
        {children}
      </body>
    </html>
  </ClerkProvider>
);

export default RootLayout;
