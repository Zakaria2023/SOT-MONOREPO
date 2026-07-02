"use client";

import { useSearch } from "@/components/layout/shell";
import { ReactNode } from "react";

export type TableColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  width?: string;
  render: (row: T) => ReactNode;
};

type TableProps<T> = {
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage?: string;
};

export const Table = <T,>({
  columns,
  data,
  emptyMessage = "No results match your search.",
}: TableProps<T>) => {
  const search = useSearch();
  const query = search.trim().toLowerCase();

  const filteredData = data.filter((row) => {
    if (query.length === 0) return true;

    return Object.values(row as Record<string, unknown>).some(
      (value) =>
        typeof value === "string" && value.toLowerCase().includes(query),
    );
  });

  const gridTemplateColumns = columns
    .map((column) => column.width ?? "1fr")
    .join(" ");

  return (
    <div className="overflow-hidden rounded-card border border-hairline bg-surface">
      <div
        className="grid gap-4 border-b border-hairline px-5 py-3 text-xs font-semibold tracking-wide text-faint uppercase"
        style={{ gridTemplateColumns }}
      >
        {columns.map((column) => (
          <span
            key={column.key}
            className={column.align === "right" ? "text-right" : ""}
          >
            {column.header}
          </span>
        ))}
      </div>

      {filteredData.length === 0 ? (
        <div className="px-5 py-16 text-center text-sm text-muted">
          {emptyMessage}
        </div>
      ) : (
        <div className="divide-y divide-hairline">
          {filteredData.map((row, index) => (
            <div
              key={index}
              className="grid items-center gap-4 px-5 py-3.5 hover:bg-hover"
              style={{ gridTemplateColumns }}
            >
              {columns.map((column) => (
                <div
                  key={column.key}
                  className={column.align === "right" ? "text-right" : ""}
                >
                  {column.render(row)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
