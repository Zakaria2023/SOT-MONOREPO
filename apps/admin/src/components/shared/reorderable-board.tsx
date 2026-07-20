"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
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

// One column: a parent (null = top level) with all of its children.
export type BoardColumnData<T extends BoardItem> = {
  parentUuid: string | null;
  parentName: string | null;
  total: number;
  items: T[];
};

type ColumnState<T extends BoardItem> = {
  items: T[];
  busy: boolean;
};

type ReorderableBoardProps<T extends BoardItem> = {
  columns: BoardColumnData<T>[];
  onReorder: (
    parentUuid: string | null,
    pageStart: number,
    orderedIds: string[],
  ) => Promise<{ error?: string }>;
  onMove: (
    uuid: string,
    targetParentUuid: string | null,
    targetIndex: number,
  ) => Promise<{ error?: string }>;
  renderActions: (item: T) => ReactNode;
  rootTitle?: string;
};

type CardContentProps<T extends BoardItem> = {
  item: T;
  childCount: number;
  renderActions: (item: T) => ReactNode;
  handleProps?: Record<string, unknown>;
  overlay?: boolean;
};

type BoardCardProps<T extends BoardItem> = {
  item: T;
  columnKey: string;
  childCount: number;
  renderActions: (item: T) => ReactNode;
};

type BoardColumnProps<T extends BoardItem> = {
  columnKey: string;
  title: string;
  total: number;
  column: ColumnState<T>;
  childCountOf: (uuid: string) => number;
  renderActions: (item: T) => ReactNode;
};

const keyOf = (parentUuid: string | null) => parentUuid ?? "root";
const parentUuidOfKey = (key: string) => (key === "root" ? null : key);

const buildState = <T extends BoardItem>(
  columns: BoardColumnData<T>[],
): Record<string, ColumnState<T>> => {
  const state: Record<string, ColumnState<T>> = {};
  for (const column of columns) {
    state[keyOf(column.parentUuid)] = { items: column.items, busy: false };
  }
  return state;
};

// The visual card body, shared by the live sortable card and the drag overlay.
const CardContent = <T extends BoardItem>({
  item,
  childCount,
  renderActions,
  handleProps,
  overlay = false,
}: CardContentProps<T>) => (
  <div
    className={`group flex items-center gap-3 rounded-control border-2 border-search-border bg-surface p-3 ${
      overlay
        ? "cursor-grabbing shadow-[0_14px_32px_rgba(27,35,51,0.20)]"
        : "shadow-[0_1px_2px_rgba(27,35,51,0.05)] transition-colors hover:border-primary/50 hover:bg-hover/40"
    }`}
  >
    <button
      type="button"
      aria-label="Drag to reorder or move"
      className="-ml-1 flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-faint transition-colors hover:bg-hover hover:text-ink active:cursor-grabbing"
      {...(handleProps ?? {})}
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
      <p className="line-clamp-1 text-sm font-semibold text-ink">{item.name}</p>
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

// A draggable card. Its sortable `data.columnKey` lets the board tell which
// column a drag started in and where it was dropped.
const BoardCard = <T extends BoardItem>({
  item,
  columnKey,
  childCount,
  renderActions,
}: BoardCardProps<T>) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.uuid, data: { columnKey } });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <CardContent
        item={item}
        childCount={childCount}
        renderActions={renderActions}
        handleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
};

// One node card / column. Droppable as a whole (so cards can be dropped into an
// empty column), with a sortable list of all its children inside.
const BoardColumn = <T extends BoardItem>({
  columnKey,
  title,
  total,
  column,
  childCountOf,
  renderActions,
}: BoardColumnProps<T>) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `col:${columnKey}`,
    data: { columnKey, isColumn: true },
  });

  return (
    <div className="flex flex-col overflow-hidden rounded-card border-2 border-hairline bg-page shadow-[0_1px_3px_rgba(27,35,51,0.06)]">
      <div className="flex items-center justify-between gap-2 border-b-2 border-hairline bg-surface px-4 py-3">
        <h2 className="line-clamp-1 text-sm font-bold tracking-wide text-ink uppercase">
          {title}
        </h2>
        <span className="rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-bold text-primary">
          {total}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex min-h-24 flex-col gap-2.5 p-3 transition-colors ${
          column.busy ? "opacity-70" : ""
        } ${isOver ? "bg-primary-tint/40" : ""}`}
      >
        {column.items.length === 0 ? (
          <p className="rounded-control border border-dashed border-hairline px-3 py-8 text-center text-xs text-faint">
            Drop a card here
          </p>
        ) : (
          <SortableContext
            items={column.items.map((item) => item.uuid)}
            strategy={verticalListSortingStrategy}
          >
            {column.items.map((item) => (
              <BoardCard
                key={item.uuid}
                item={item}
                columnKey={columnKey}
                childCount={childCountOf(item.uuid)}
                renderActions={renderActions}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
};

export const ReorderableBoard = <T extends BoardItem>({
  columns,
  onReorder,
  onMove,
  renderActions,
  rootTitle = "Top level",
}: ReorderableBoardProps<T>) => {
  const [state, setState] = useState(() => buildState(columns));
  const [prevColumns, setPrevColumns] = useState(columns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-sync when the server sends fresh columns (revalidation after a move,
  // create, or delete) — authoritative over any optimistic state.
  if (columns !== prevColumns) {
    setPrevColumns(columns);
    setState(buildState(columns));
    setError(null);
  }

  const totalByKey = new Map<string, number>();
  for (const column of columns) {
    totalByKey.set(keyOf(column.parentUuid), column.total);
  }
  const childCountOf = (uuid: string) => totalByKey.get(uuid) ?? 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeItem = activeId
    ? (Object.values(state)
        .flatMap((column) => column.items)
        .find((item) => item.uuid === activeId) ?? null)
    : null;

  const setColumn = (key: string, patch: Partial<ColumnState<T>>) =>
    setState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) {
      return;
    }
    const activeUuid = String(active.id);
    const sourceKey = active.data.current?.columnKey as string | undefined;
    if (!sourceKey) {
      return;
    }

    const overData = over.data.current as
      | { columnKey?: string; isColumn?: boolean }
      | undefined;
    let targetKey: string | undefined;
    let overItemId: string | null = null;
    if (overData?.isColumn) {
      targetKey = overData.columnKey;
    } else if (overData?.columnKey) {
      targetKey = overData.columnKey;
      overItemId = String(over.id);
    }
    if (!targetKey) {
      return;
    }

    // --- Reorder within the same column ---
    if (sourceKey === targetKey) {
      const items = state[sourceKey].items;
      const oldIndex = items.findIndex((item) => item.uuid === activeUuid);
      const newIndex = overItemId
        ? items.findIndex((item) => item.uuid === overItemId)
        : items.length - 1;
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return;
      }
      const next = arrayMove(items, oldIndex, newIndex);
      setColumn(sourceKey, { items: next });
      setError(null);
      const result = await onReorder(
        parentUuidOfKey(sourceKey),
        0,
        next.map((item) => item.uuid),
      );
      if (result.error) {
        setError(result.error);
        setState(buildState(columns));
      }
      return;
    }

    // --- Move into another column (re-parent) ---
    const moved = state[sourceKey].items.find(
      (item) => item.uuid === activeUuid,
    );
    const targetItems = state[targetKey].items;
    const overIndex = overItemId
      ? targetItems.findIndex((item) => item.uuid === overItemId)
      : targetItems.length;
    const insertAt = Math.max(0, overIndex);

    // Optimistically remove from source and insert into target.
    setState((prev) => {
      const src = prev[sourceKey];
      const tgt = prev[targetKey];
      const nextSrc = src.items.filter((item) => item.uuid !== activeUuid);
      const nextTgt = moved
        ? [...tgt.items.slice(0, insertAt), moved, ...tgt.items.slice(insertAt)]
        : tgt.items;
      return {
        ...prev,
        [sourceKey]: { ...src, items: nextSrc, busy: true },
        [targetKey]: { ...tgt, items: nextTgt, busy: true },
      };
    });
    setError(null);

    const result = await onMove(activeUuid, parentUuidOfKey(targetKey), insertAt);
    if (result.error) {
      setError(result.error);
      // Revert to the last server-authoritative view.
      setState(buildState(columns));
    }
    // On success revalidatePath refreshes the columns prop, which re-syncs.
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] items-start gap-4">
        {columns.map((column) => {
          const key = keyOf(column.parentUuid);
          const columnState = state[key] ?? { items: column.items, busy: false };
          return (
            <BoardColumn
              key={key}
              columnKey={key}
              title={column.parentName ?? rootTitle}
              total={column.total}
              column={columnState}
              childCountOf={childCountOf}
              renderActions={renderActions}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeItem ? (
          <CardContent
            item={activeItem}
            childCount={childCountOf(activeItem.uuid)}
            renderActions={renderActions}
            overlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
