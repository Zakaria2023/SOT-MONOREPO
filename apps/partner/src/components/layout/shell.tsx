import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Sidebar } from "@/components/layout/sidebar";

type ShellProps = {
  children: ReactNode;
};

export const Shell = ({ children }: ShellProps) => (
  <div className="min-h-screen">
    <Sidebar />

    <div className="ml-18 flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  </div>
);
