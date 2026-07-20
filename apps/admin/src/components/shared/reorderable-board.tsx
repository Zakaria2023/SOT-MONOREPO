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
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ImageOff,
  Layers,
} from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { documentDownloadUrl } from "@/lib/documents";

// Cards shown per column before paging kicks in.
const PAGE_SIZE = 8;

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
        opacity: isDragging ? 0.6 : 1,
        boxShadow: isDragging
          ? "0 12px 28px rgba(27,35,51,0.16)"
          : undefined,
      }}
      className="group flex items-center gap-3 rounded-control border-2 border-search-border bg-surface p-3 shadow-[0_1px_2px_rgba(27,35,51,0.05)] transition-colors hover:border-primary/50 hover:bg-hover/40"
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        className="-ml-1 flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-faint transition-colors hover:bg-hover hover:text-ink active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      {item.image ? (
        <Image
          src={documentDownloadUrl(item.image)}
          alt={item.name}
          width={40}
          height={40}
          unoptimized
          className="h-10 w-10 shrink-0 rounded-control border border-hairline object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-hairline bg-page text-faint">
          <ImageOff size={16} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-semibold text-ink">
          {item.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="whitespace-nowrap rounded-full bg-hover px-2 py-0.5 text-[11px] font-medium text-muted">
            {item.productCount}{" "}
            {item.productCount === 1 ? "product" : "products"}
          </span>
          {childCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary-tint px-2 py-0.5 text-[11px] font-semibold text-primary">
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
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Re-sync when the server sends a fresh list (revalidation), the same
  // render-time reset the reorderable table uses.
  if (column.items !== prevItems) {
    setPrevItems(column.items);
    setItems(column.items);
  }

  // Paginate the column. Dragging still reorders against the full `items`
  // list (absolute indices), so order persists across pages — only the visible
  // window is sliced here.
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageItems = items.slice(pageStart, pageStart + PAGE_SIZE);

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
    <div className="flex flex-col overflow-hidden rounded-card border-2 border-hairline bg-page shadow-[0_1px_3px_rgba(27,35,51,0.06)]">
      <div className="flex items-center justify-between gap-2 border-b-2 border-hairline bg-surface px-4 py-3">
        <h2 className="line-clamp-1 text-sm font-bold tracking-wide text-ink uppercase">
          {column.title}
        </h2>
        <span className="rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-bold text-primary">
          {items.length}
        </span>
      </div>

      <div
        className={`flex flex-col gap-2.5 p-3 ${isPending ? "opacity-70" : ""}`}
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
              items={pageItems.map((item) => item.uuid)}
              strategy={verticalListSortingStrategy}
            >
              {pageItems.map((item) => (
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

        {totalPages > 1 && (
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-hairline pt-3">
            <button
              type="button"
              aria-label="Previous page"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-control border border-hairline text-secondary transition-colors hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-medium text-muted">
              Page {safePage + 1} of {totalPages}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(safePage + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-control border border-hairline text-secondary transition-colors hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronRight size={16} />
            </button>
          </div>
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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] items-start gap-4">
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
