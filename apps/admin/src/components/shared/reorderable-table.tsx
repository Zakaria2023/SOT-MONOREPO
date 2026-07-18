"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState, useTransition } from "react";
import type { ReactNode } from "react";

export type ReorderColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
};

type ReorderableTableProps<T> = {
  rows: T[];
  columns: ReorderColumn<T>[];
  getId: (row: T) => string;
  onReorder: (orderedIds: string[]) => Promise<{ error?: string }>;
  emptyMessage?: string;
};

type SortableRowProps<T> = {
  row: T;
  id: string;
  columns: ReorderColumn<T>[];
};

const SortableRow = <T,>({ row, id, columns }: SortableRowProps<T>) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="bg-surface transition-colors hover:bg-hover"
    >
      <td className="w-10 px-3 py-4">
        <button
          type="button"
          aria-label="Drag to reorder"
          className="cursor-grab text-faint hover:text-ink active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
      </td>
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
  );
};

export const ReorderableTable = <T,>({
  rows,
  columns,
  getId,
  onReorder,
  emptyMessage = "Nothing to reorder here.",
}: ReorderableTableProps<T>) => {
  const [items, setItems] = useState(rows);
  const [prevRows, setPrevRows] = useState(rows);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Re-sync when the server sends a fresh list (revalidation or a parent
  // change): adjusting state during render is React's recommended way to
  // reset state from a changed prop, without an effect.
  if (rows !== prevRows) {
    setPrevRows(rows);
    setItems(rows);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex((item) => getId(item) === active.id);
    const newIndex = items.findIndex((item) => getId(item) === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    setError(null);

    startTransition(async () => {
      const result = await onReorder(next.map(getId));
      if (result.error) {
        setError(result.error);
        // Roll back to the server's order on failure.
        setItems(rows);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="overflow-x-auto rounded-card border border-hairline bg-surface shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-hairline bg-hover">
              <th className="w-10 px-3 py-3.5" />
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

          {items.length > 0 && (
            <tbody
              className={`divide-y divide-hairline-soft ${
                isPending ? "opacity-70" : ""
              }`}
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={items.map(getId)}
                  strategy={verticalListSortingStrategy}
                >
                  {items.map((row) => (
                    <SortableRow
                      key={getId(row)}
                      id={getId(row)}
                      row={row}
                      columns={columns}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </tbody>
          )}
        </table>

        {items.length === 0 && (
          <div className="px-5 py-16 text-center text-sm text-muted">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
};
