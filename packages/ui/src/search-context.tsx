"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

// Backs the Table's client-side filtering. Apps can wrap content in a
// SearchProvider to drive it; unwrapped, it resolves to an empty query.
const SearchContext = createContext("");

type SearchProviderProps = {
  value?: string;
  children: ReactNode;
};

export const SearchProvider = ({
  value = "",
  children,
}: SearchProviderProps) => (
  <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
);

export const useSearch = () => useContext(SearchContext);
