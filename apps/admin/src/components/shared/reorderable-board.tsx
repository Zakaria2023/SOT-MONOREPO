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
import { GripVertical, ImageOff, Layers } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { documentDownloadUrl } from "@/lib/documents";

// The minimal shape the board needs from a category/brand list item — both
// satisfy it, so one board serves both pages.
export type BoardItem = {
  uuid: string;
  name: string;
  parentUuid: string | null;
  parentName: string | null;
  image: string | null;
  productCount: number;
};

type Column<T> = {
  key: string;
  title: string;
  items: T[];
};

type ReorderableBoardProps<T extends BoardItem> = {
  items: T[];
  onReorder: (orderedIds: string[]) => Promise<{ error?: string }>;
  renderActions: (item: T) => ReactNode;
  rootTitle?: string;
};

type BoardCardProps<T extends BoardItem> = {
  item: T;
  childCount: number;
  renderActions: (item: T) => ReactNode;
};

type BoardColumnProps<T extends BoardItem> = {
  column: Column<T>;
  childCountOf: (uuid: string) => number;
  onReorder: (orderedIds: string[]) => Promise<{ error?: string }>;
  renderActions: (item: T) => ReactNode;
};

// One draggable card inside a column. The grip is the only drag handle so the
// action buttons and links inside stay clickable.
const BoardCard = <T extends BoardItem>({
  item,
  childCount,
  renderActions,
}: BoardCardProps<T>) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.uuid });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-2.5 rounded-control border border-hairline bg-surface p-2.5 shadow-[0_1px_2px_rgba(27,35,51,0.04)]"
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        className="cursor-grab text-faint hover:text-ink active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      {item.image ? (
        <Image
          src={documentDownloadUrl(item.image)}
          alt={item.name}
          width={36}
          height={36}
          unoptimized
          className="h-9 w-9 shrink-0 rounded-control object-cover"
        />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-hover text-faint">
          <ImageOff size={15} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-semibold text-ink">
          {item.name}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-faint">
          <span>
            {item.productCount}{" "}
            {item.productCount === 1 ? "product" : "products"}
          </span>
          {childCount > 0 && (
            <span className="inline-flex items-center gap-1 text-primary">
              <Layers size={11} />
              {childCount}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0">{renderActions(item)}</div>
    </div>
  );
};

// One node card: a fixed-width column whose items reorder among themselves.
// The column itself is not draggable — only the cards inside it are.
const BoardColumn = <T extends BoardItem>({
  column,
  childCountOf,
  onReorder,
  renderActions,
}: BoardColumnProps<T>) => {
  const [items, setItems] = useState(column.items);
  const [prevItems, setPrevItems] = useState(column.items);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Re-sync when the server sends a fresh list (revalidation), the same
  // render-time reset the reorderable table uses.
  if (column.items !== prevItems) {
    setPrevItems(column.items);
    setItems(column.items);
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
    const oldIndex = items.findIndex((item) => item.uuid === active.id);
    const newIndex = items.findIndex((item) => item.uuid === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    setError(null);

    startTransition(async () => {
      const result = await onReorder(next.map((item) => item.uuid));
      if (result.error) {
        setError(result.error);
        setItems(column.items);
      }
    });
  };

  return (
    <div className="flex flex-col rounded-card border border-hairline bg-page">
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
        <h2 className="line-clamp-1 text-sm font-semibold text-ink">
          {column.title}
        </h2>
        <span className="rounded-full bg-primary-tint px-2 py-0.5 text-xs font-semibold text-primary">
          {items.length}
        </span>
      </div>

      <div
        className={`flex flex-col gap-2 p-3 ${isPending ? "opacity-70" : ""}`}
      >
        {error && <p className="text-xs text-danger">{error}</p>}

        {items.length === 0 ? (
          <p className="rounded-control border border-dashed border-hairline px-3 py-8 text-center text-xs text-faint">
            Nothing here yet.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((item) => item.uuid)}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item) => (
                <BoardCard
                  key={item.uuid}
                  item={item}
                  childCount={childCountOf(item.uuid)}
                  renderActions={renderActions}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
};

export const ReorderableBoard = <T extends BoardItem>({
  items,
  onReorder,
  renderActions,
  rootTitle = "Top level",
}: ReorderableBoardProps<T>) => {
  // Group children by their parent. Items arrive ordered by `order`, so each
  // group stays in its saved per-parent order.
  const childrenOf = new Map<string | null, T[]>();
  for (const item of items) {
    const key = item.parentUuid ?? null;
    const bucket = childrenOf.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      childrenOf.set(key, [item]);
    }
  }

  const childCountOf = (uuid: string) => childrenOf.get(uuid)?.length ?? 0;

  // One column for the top level, then one for every item that has children —
  // in the items' existing order, so the board reads top-down like the tree.
  const columns: Column<T>[] = [
    { key: "root", title: rootTitle, items: childrenOf.get(null) ?? [] },
  ];
  for (const item of items) {
    if (childrenOf.has(item.uuid)) {
      columns.push({
        key: item.uuid,
        title: item.name,
        items: childrenOf.get(item.uuid) ?? [],
      });
    }
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] items-start gap-4">
      {columns.map((column) => (
        <BoardColumn
          key={column.key}
          column={column}
          childCountOf={childCountOf}
          onReorder={onReorder}
          renderActions={renderActions}
        />
      ))}
    </div>
  );
};
