"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input, useDebouncedCallback } from "ui";

type ListSearchProps = {
  placeholder?: string;
  paramName?: string;
};

export const ListSearch = ({
  placeholder = "Search...",
  paramName = "search",
}: ListSearchProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get(paramName) ?? "");

  // Debounced so we don't navigate on every keystroke; the server component
  // re-runs with the new `search` param and resets to page 1.
  const commit = useDebouncedCallback((next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.trim()) {
      params.set(paramName, next.trim());
    } else {
      params.delete(paramName);
    }
    // A changed search always restarts from the first page.
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, 300);

  return (
    <div className="w-full max-w-sm">
      <Input
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          commit(event.target.value);
        }}
        placeholder={placeholder}
        icon={<Search size={16} />}
      />
    </div>
  );
};
