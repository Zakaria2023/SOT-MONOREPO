"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dropdown } from "ui";

type Option = {
  uuid: string;
  name: string;
};

type ProductsFiltersProps = {
  categories: Option[];
  brands: Option[];
};

/**
 * Category and brand filters for the products list.
 *
 * They write to the URL like the search box does, so the server component re-runs
 * the query — the list is never filtered in the browser, which would page through
 * whatever happened to be on screen.
 *
 * Both reset the page. Narrowing to one brand while standing on page 4 otherwise
 * lands on an empty grid that reads as "this brand has no products".
 */
export const ProductsFilters = ({
  categories,
  brands,
}: ProductsFiltersProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const toOptions = (rows: Option[], allLabel: string) => [
    { value: "", label: allLabel },
    ...rows.map((row) => ({ value: row.uuid, label: row.name })),
  ];

  return (
    <div className="flex flex-wrap gap-3">
      <div className="w-56">
        <Dropdown
          value={searchParams.get("category") ?? ""}
          onChange={(value) => setParam("category", value)}
          options={toOptions(categories, "All categories")}
          placeholder="All categories"
        />
      </div>
      <div className="w-56">
        <Dropdown
          value={searchParams.get("brand") ?? ""}
          onChange={(value) => setParam("brand", value)}
          options={toOptions(brands, "All brands")}
          placeholder="All brands"
        />
      </div>
    </div>
  );
};
