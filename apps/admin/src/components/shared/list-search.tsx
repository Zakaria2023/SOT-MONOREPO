"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "ui";

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

  // Debounce writes to the URL so we don't navigate on every keystroke. The
  // server component re-runs with the new `search` param and returns page 1.
  useEffect(() => {
    const current = searchParams.get(paramName) ?? "";
    if (value === current) {
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set(paramName, value.trim());
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

    return () => clearTimeout(timer);
  }, [value, paramName, pathname, router, searchParams]);

  return (
    <div className="w-full max-w-sm">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        icon={<Search size={16} />}
      />
    </div>
  );
};
