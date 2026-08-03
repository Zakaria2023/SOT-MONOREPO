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
import {
  ChevronRight,
  GripVertical,
  ImageOff,
  Layers,
  Loader2,
  Shapes,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { documentImageUrl } from "@/lib/documents";

// The minimal shape the board needs from a category/brand list item — both
// satisfy it, so one board serves both pages. `childCount` is the card's own
// direct child count, so a card knows whether it can be expanded without the
// board ever loading any other column.
export type BoardItem = {
  uuid: string;
  name: string;
  parentUuid: string | null;
  parentName: string | null;
  image: string | null;
  productCount: number;
  childCount: number;
  // Optional — categories carry a classification name; brands don't.
  classificationName?: string | null;
};

// The loaded state of one on-screen column.
type ColumnState<T extends BoardItem> = {
  items: T[];
  busy: boolean;
  loading: boolean;
};

// An opened child column: its parent's uuid (the column key), its title, its
// child total, and the column it was opened from — so closing a column also
// closes the columns opened beneath it.
type OpenColumn = {
  key: string;
  title: string;
  total: number;
  fromKey: string;
};

type ReorderableBoardProps<T extends BoardItem> = {
  // The top-level cards, rendered as the first column.
  rootItems: T[];
  // Lazily fetch one parent's children when its card is opened.
  loadColumn: (parentUuid: string) => Promise<T[]>;
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
  isOpen: boolean;
  onOpen?: () => void;
  renderActions: (item: T) => ReactNode;
  handleProps?: Record<string, unknown>;
  overlay?: boolean;
};

type BoardCardProps<T extends BoardItem> = {
  item: T;
  columnKey: string;
  isOpen: boolean;
  onOpen: () => void;
  renderActions: (item: T) => ReactNode;
};

type BoardColumnProps<T extends BoardItem> = {
  columnKey: string;
  title: string;
  total: number;
  column: ColumnState<T>;
  openKeys: Set<string>;
  onOpen: (item: T, fromKey: string) => void;
  renderActions: (item: T) => ReactNode;
};

const ROOT = "root";

const parentUuidOfKey = (key: string) => (key === ROOT ? null : key);

const emptyColumn = <T extends BoardItem>(): ColumnState<T> => ({
  items: [],
  busy: false,
  loading: false,
});

// The visual card body, shared by the live sortable card and the drag overlay.
const CardContent = <T extends BoardItem>({
  item,
  isOpen,
  onOpen,
  renderActions,
  handleProps,
  overlay = false,
}: CardContentProps<T>) => {
  const openable = item.childCount > 0 && !overlay;

  return (
    <div
      onClick={openable ? onOpen : undefined}
      className={`group flex items-center gap-3 rounded-control border-2 bg-surface p-3 ${
        openable ? "cursor-pointer" : ""
      } ${
        isOpen ? "border-primary bg-primary-tint/30" : "border-search-border"
      } ${
        overlay
          ? "cursor-grabbing shadow-[0_14px_32px_rgba(27,35,51,0.20)]"
          : "shadow-[0_1px_2px_rgba(27,35,51,0.05)] transition-colors hover:border-primary/50 hover:bg-hover/40"
      }`}
    >
      <button
        type="button"
        aria-label="Drag to reorder or move"
        onClick={(event) => event.stopPropagation()}
        className="-ml-1 flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-faint transition-colors hover:bg-hover hover:text-ink active:cursor-grabbing"
        {...(handleProps ?? {})}
      >
        <GripVertical size={16} />
      </button>

      {item.image ? (
        <Image
          src={documentImageUrl(item.image)}
          alt={item.name}
          width={40}
          height={40}
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
          {item.childCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary-tint px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Layers size={11} />
              {item.childCount}
            </span>
          )}
          {item.classificationName && (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-hover px-2 py-0.5 text-[11px] font-medium text-secondary">
              <Shapes size={11} />
              {item.classificationName}
            </span>
          )}
        </div>
      </div>

      {openable && (
        <ChevronRight
          size={16}
          className={`shrink-0 text-faint transition-transform ${
            isOpen ? "rotate-90 text-primary" : ""
          }`}
        />
      )}

      <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
        {renderActions(item)}
      </div>
    </div>
  );
};

// A draggable card. Its sortable `data.columnKey` lets the board tell which
// column a drag started in and where it was dropped.
const BoardCard = <T extends BoardItem>({
  item,
  columnKey,
  isOpen,
  onOpen,
  renderActions,
}: BoardCardProps<T>) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.uuid, data: { columnKey } });

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
        isOpen={isOpen}
        onOpen={onOpen}
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
  openKeys,
  onOpen,
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
        {column.loading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-8 text-xs text-faint">
            <Loader2 size={14} className="animate-spin" />
            Loading…
          </div>
        ) : column.items.length === 0 ? (
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
                isOpen={openKeys.has(item.uuid)}
                onOpen={() => onOpen(item, columnKey)}
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
  rootItems,
  loadColumn,
  onReorder,
  onMove,
  renderActions,
  rootTitle = "Top level",
}: ReorderableBoardProps<T>) => {
  const [openColumns, setOpenColumns] = useState<OpenColumn[]>([]);
  const [state, setState] = useState<Record<string, ColumnState<T>>>(() => ({
    [ROOT]: { items: rootItems, busy: false, loading: false },
  }));
  const [prevRootItems, setPrevRootItems] = useState(rootItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-sync the root column when the server sends fresh top-level items (a
  // revalidation after a move, create, or delete) — authoritative over any
  // optimistic state.
  if (rootItems !== prevRootItems) {
    setPrevRootItems(rootItems);
    setState((prev) => ({
      ...prev,
      [ROOT]: { items: rootItems, busy: false, loading: false },
    }));
    setError(null);
  }

  // A ref so the revalidation effect can read the currently-open columns
  // without re-running every time one opens or closes. Kept current in an
  // effect (writing a ref during render is disallowed).
  const openColumnsRef = useRef(openColumns);
  useEffect(() => {
    openColumnsRef.current = openColumns;
  });

  // When the server data changes (revalidation after a move/create/delete),
  // reload every open child column from source so their cards, counts, and
  // order reflect the database. The root column re-syncs from props above.
  useEffect(() => {
    let cancelled = false;
    for (const column of openColumnsRef.current) {
      const { key } = column;
      setState((prev) => ({
        ...prev,
        [key]: { ...(prev[key] ?? emptyColumn()), loading: true },
      }));
      loadColumn(key)
        .then((items) => {
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              [key]: { items, busy: false, loading: false },
            }));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              [key]: { ...(prev[key] ?? emptyColumn()), loading: false },
            }));
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [rootItems, loadColumn]);

  const openKeys = new Set(openColumns.map((column) => column.key));

  // Close a column and every column that was opened from within it.
  const closeColumn = (key: string) => {
    const remove = new Set<string>([key]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const column of openColumns) {
        if (!remove.has(column.key) && remove.has(column.fromKey)) {
          remove.add(column.key);
          changed = true;
        }
      }
    }
    setOpenColumns((prev) => prev.filter((column) => !remove.has(column.key)));
    setState((prev) => {
      const next = { ...prev };
      for (const removedKey of remove) {
        if (removedKey !== ROOT) {
          delete next[removedKey];
        }
      }
      return next;
    });
  };

  // Open a card's column (or close it if already open), loading its children.
  const openColumn = async (item: T, fromKey: string) => {
    const key = item.uuid;
    if (openKeys.has(key)) {
      closeColumn(key);
      return;
    }
    setOpenColumns((prev) => [
      ...prev,
      { key, title: item.name, total: item.childCount, fromKey },
    ]);
    setState((prev) => ({
      ...prev,
      [key]: { items: [], busy: false, loading: true },
    }));
    try {
      const items = await loadColumn(key);
      setState((prev) => ({
        ...prev,
        [key]: { items, busy: false, loading: false },
      }));
    } catch {
      setError("Failed to load this column. Try again.");
      closeColumn(key);
    }
  };

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
    setState((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? emptyColumn()), ...patch },
    }));

  // Reload one open (or root) column from the server.
  const reload = async (key: string) => {
    if (key === ROOT) {
      return;
    }
    setColumn(key, { loading: true });
    try {
      const items = await loadColumn(key);
      setColumn(key, { items, busy: false, loading: false });
    } catch {
      setColumn(key, { busy: false, loading: false });
    }
  };

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
      { columnKey?: string; isColumn?: boolean } | undefined;
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
      const items = state[sourceKey]?.items ?? [];
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
        setColumn(sourceKey, { items });
      }
      return;
    }

    // --- Move into another column (re-parent) ---
    const moved = state[sourceKey]?.items.find(
      (item) => item.uuid === activeUuid,
    );
    const targetItems = state[targetKey]?.items ?? [];
    const overIndex = overItemId
      ? targetItems.findIndex((item) => item.uuid === overItemId)
      : targetItems.length;
    const insertAt = Math.max(0, overIndex);

    // Optimistically remove from source and insert into target.
    setState((prev) => {
      const src = prev[sourceKey] ?? emptyColumn();
      const tgt = prev[targetKey] ?? emptyColumn();
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

    const result = await onMove(
      activeUuid,
      parentUuidOfKey(targetKey),
      insertAt,
    );
    if (result.error) {
      setError(result.error);
      // Reload the two affected columns from source to recover.
      void reload(sourceKey);
      void reload(targetKey);
    }
    // On success, revalidatePath refreshes rootItems, and the effect above
    // reloads the open columns from the database.
  };

  const columnsToRender = [
    {
      key: ROOT,
      title: rootTitle,
      total: (state[ROOT] ?? emptyColumn()).items.length,
    },
    ...openColumns.map((column) => ({
      key: column.key,
      title: column.title,
      total: column.total,
    })),
  ];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(event: DragStartEvent) =>
        setActiveId(String(event.active.id))
      }
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] items-start gap-4">
        {columnsToRender.map((column) => (
          <BoardColumn
            key={column.key}
            columnKey={column.key}
            title={column.title}
            total={column.total}
            column={state[column.key] ?? emptyColumn()}
            openKeys={openKeys}
            onOpen={openColumn}
            renderActions={renderActions}
          />
        ))}
      </div>

      <DragOverlay>
        {activeItem ? (
          <CardContent
            item={activeItem}
            isOpen={openKeys.has(activeItem.uuid)}
            renderActions={renderActions}
            overlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
