"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";

type ShellProps = {
  title?: string;
  subtitle?: string;
  searchPlaceholder?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
};

const SearchContext = createContext("");

export const useSearch = () => useContext(SearchContext);

export const Shell = ({
  title = "Overview",
  subtitle,
  searchPlaceholder,
  actionLabel,
  onAction,
  children,
}: ShellProps) => {
  const [search, setSearch] = useState("");

  return (
    <SearchContext.Provider value={search}>
      <div className="flex h-screen">
        <Sidebar />

        <div className="flex flex-1 flex-col overflow-y-auto">
          <Navbar
            title={title}
            subtitle={subtitle}
            search={search}
            onSearchChange={(event) => setSearch(event.target.value)}
            searchPlaceholder={searchPlaceholder}
            actionLabel={actionLabel}
            onAction={onAction}
          />

          <main className="flex-1 px-7.5 py-6.5">{children}</main>
        </div>
      </div>
    </SearchContext.Provider>
  );
};
