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
  Loader2,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
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

// One column as computed on the server: a parent (null = top level), its total
// child count, and only the first page of children.
export type BoardColumnData<T extends BoardItem> = {
  parentUuid: string | null;
  parentName: string | null;
  total: number;
  items: T[];
};

type ReorderableBoardProps<T extends BoardItem> = {
  columns: BoardColumnData<T>[];
  pageSize: number;
  fetchPage: (parentUuid: string | null, page: number) => Promise<T[]>;
  onReorder: (
    parentUuid: string | null,
    pageStart: number,
    orderedIds: string[],
  ) => Promise<{ error?: string }>;
  renderActions: (item: T) => ReactNode;
  rootTitle?: string;
};

type BoardCardProps<T extends BoardItem> = {
  item: T;
  childCount: number;
  renderActions: (item: T) => ReactNode;
};

type BoardColumnProps<T extends BoardItem> = {
  column: BoardColumnData<T>;
  title: string;
  pageSize: number;
  childCountOf: (uuid: string) => number;
  fetchPage: (parentUuid: string | null, page: number) => Promise<T[]>;
  onReorder: (
    parentUuid: string | null,
    pageStart: number,
    orderedIds: string[],
  ) => Promise<{ error?: string }>;
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
        boxShadow: isDragging ? "0 12px 28px rgba(27,35,51,0.16)" : undefined,
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

// One node card: a column whose items reorder among themselves. Only the
// current page (8 cards) is held in state; other pages are fetched on demand.
// The column itself is not draggable — only the cards inside it are.
const BoardColumn = <T extends BoardItem>({
  column,
  title,
  pageSize,
  childCountOf,
  fetchPage,
  onReorder,
  renderActions,
}: BoardColumnProps<T>) => {
  const [items, setItems] = useState(column.items);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-sync page 0 when the server sends a fresh column (revalidation after a
  // create/delete/reorder), the render-time reset pattern React recommends.
  const [prevColumn, setPrevColumn] = useState(column);
  if (column !== prevColumn) {
    setPrevColumn(column);
    setItems(column.items);
    setPage(0);
  }

  const totalPages = Math.max(1, Math.ceil(column.total / pageSize));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const goToPage = async (next: number) => {
    const target = Math.max(0, Math.min(next, totalPages - 1));
    if (target === page || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const rows = await fetchPage(column.parentUuid, target);
      setItems(rows);
      setPage(target);
    } catch {
      setError("Failed to load page.");
    } finally {
      setBusy(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
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
    setBusy(true);

    const pageStart = page * pageSize;
    const result = await onReorder(
      column.parentUuid,
      pageStart,
      next.map((item) => item.uuid),
    );
    if (result.error) {
      setError(result.error);
      // Reload the current page from the server on failure.
      try {
        setItems(await fetchPage(column.parentUuid, page));
      } catch {
        /* keep the optimistic order if the reload also fails */
      }
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-card border-2 border-hairline bg-page shadow-[0_1px_3px_rgba(27,35,51,0.06)]">
      <div className="flex items-center justify-between gap-2 border-b-2 border-hairline bg-surface px-4 py-3">
        <h2 className="line-clamp-1 text-sm font-bold tracking-wide text-ink uppercase">
          {title}
        </h2>
        <span className="rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-bold text-primary">
          {column.total}
        </span>
      </div>

      <div className={`flex flex-col gap-2.5 p-3 ${busy ? "opacity-70" : ""}`}>
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

        {totalPages > 1 && (
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-hairline pt-3">
            <button
              type="button"
              aria-label="Previous page"
              disabled={page === 0 || busy}
              onClick={() => goToPage(page - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-control border border-hairline text-secondary transition-colors hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
              {busy && <Loader2 size={12} className="animate-spin" />}
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= totalPages - 1 || busy}
              onClick={() => goToPage(page + 1)}
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
  columns,
  pageSize,
  fetchPage,
  onReorder,
  renderActions,
  rootTitle = "Top level",
}: ReorderableBoardProps<T>) => {
  // A card that is itself a parent shows its child count — look it up from the
  // column whose parentUuid is that card's uuid.
  const totalByParent = new Map<string, number>();
  for (const column of columns) {
    if (column.parentUuid) {
      totalByParent.set(column.parentUuid, column.total);
    }
  }
  const childCountOf = (uuid: string) => totalByParent.get(uuid) ?? 0;

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] items-start gap-4">
      {columns.map((column) => (
        <BoardColumn
          key={column.parentUuid ?? "root"}
          column={column}
          title={column.parentName ?? rootTitle}
          pageSize={pageSize}
          childCountOf={childCountOf}
          fetchPage={fetchPage}
          onReorder={onReorder}
          renderActions={renderActions}
        />
      ))}
    </div>
  );
};
