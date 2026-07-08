import { ReactNode } from "react";

export type TableColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
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
  emptyMessage = "No results.",
}: TableProps<T>) => (
  <div className="overflow-x-auto rounded-card border border-hairline bg-surface shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-hairline bg-hover">
          {columns.map((column) => (
            <th
              key={column.key}
              className={`px-6 py-3.5 text-xs font-semibold tracking-wide text-muted uppercase ${
                column.align === "right" ? "text-right" : "text-left"
              }`}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>

      {data.length > 0 && (
        <tbody className="divide-y divide-hairline-soft">
          {data.map((row, index) => (
            <tr key={index} className="transition-colors hover:bg-hover">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-6 py-4 text-sm text-ink ${
                    column.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      )}
    </table>

    {data.length === 0 && (
      <div className="px-5 py-16 text-center text-sm text-muted">
        {emptyMessage}
      </div>
    )}
  </div>
);
