import { Shell } from "@/components/layout/shell";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stratum Admin",
  description: "Stratum admin dashboard",
};

type Props = {
  children: ReactNode;
};

const RootLayout = ({ children }: Props) => {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full antialiased">
        <body className="min-h-full flex flex-col text-ink font-sans">
          <Shell>{children}</Shell>
        </body>
      </html>
    </ClerkProvider>
  );
};

export default RootLayout;
