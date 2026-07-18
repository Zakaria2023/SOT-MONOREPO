"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Dropdown } from "ui";
import type { DropdownOption } from "ui";

type ParentItem = {
  uuid: string;
  name: string;
  parentUuid: string | null;
};

type ParentFilterProps = {
  items: ParentItem[];
  browseLabel?: string;
  label?: string;
};

// Flatten the items into depth-ordered options so the tree reads naturally.
const buildTreeOptions = (items: ParentItem[]): DropdownOption[] => {
  const present = new Set(items.map((item) => item.uuid));
  const childrenByParent = new Map<string | null, ParentItem[]>();

  for (const item of items) {
    const parentUuid =
      item.parentUuid && present.has(item.parentUuid) ? item.parentUuid : null;
    const siblings = childrenByParent.get(parentUuid) ?? [];
    siblings.push(item);
    childrenByParent.set(parentUuid, siblings);
  }

  const options: DropdownOption[] = [];
  const walk = (parentUuid: string | null, depth: number) => {
    for (const item of childrenByParent.get(parentUuid) ?? []) {
      options.push({ value: item.uuid, label: item.name, depth });
      walk(item.uuid, depth + 1);
    }
  };
  walk(null, 0);
  return options;
};

export const ParentFilter = ({
  items,
  browseLabel = "All (browse)",
  label = "Reorder within",
}: ParentFilterProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const options = useMemo<DropdownOption[]>(
    () => [
      { value: "", label: browseLabel },
      { value: "root", label: "Top level" },
      ...buildTreeOptions(items),
    ],
    [items, browseLabel],
  );

  const current = searchParams.get("parent") ?? "";

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("parent", value);
    } else {
      params.delete("parent");
    }
    // Reorder mode ignores search/paging — clear them when switching.
    params.delete("page");
    params.delete("search");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  return (
    <div className="flex w-full max-w-xs flex-col gap-1.5">
      <label className="text-sm font-semibold text-ink">{label}</label>
      <Dropdown
        searchable
        searchPlaceholder="Search..."
        value={current}
        onChange={onChange}
        options={options}
        placeholder={browseLabel}
      />
    </div>
  );
};
