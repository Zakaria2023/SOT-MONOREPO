"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Sidebar } from "@/components/layout/sidebar";

type ShellProps = {
  children: ReactNode;
};

// Kept so the Table's client-side filtering still resolves; the global search
// input was removed from the navbar, so this is always empty for now.
const SearchContext = createContext("");

export const useSearch = () => useContext(SearchContext);

export const Shell = ({ children }: ShellProps) => (
  <SearchContext.Provider value="">
    <div className="min-h-screen">
      <Sidebar />

      <div className="ml-18 flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  </SearchContext.Provider>
);
