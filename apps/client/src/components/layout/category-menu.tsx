"use client";

import { getMenuProducts } from "@/app/products/actions";
import type { CategoryNode } from "@/lib/categories";
import { documentImageUrl } from "@/lib/documents";
import { formatPrice } from "utils";
import { cn } from "@/lib/utils";
import { ChevronDown, ImageOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import type { ProductSummary } from "services";

type CategoryMenuProps = {
  categories: CategoryNode[];
};

type TreeItemProps = {
  node: CategoryNode;
  depth: number;
  selectedUuid: string | null;
  openUuids: Set<string>;
  onSelect: (node: CategoryNode) => void;
  onToggle: (uuid: string) => void;
  /** Called when a row navigates, so the panel closes behind the click. */
  onNavigate: () => void;
};

type ProductTileProps = {
  product: ProductSummary;
};

// Every uuid under a node, because products sit in the leaves: a query for the
// family alone comes back empty.
const subtreeUuids = (node: CategoryNode): string[] => [
  node.uuid,
  ...node.children.flatMap(subtreeUuids),
];

// Products under a node AND under everything beneath it, for the count beside
// each row. The stored productCount is the node's own, which reads 0 on a parent.
const subtreeCount = (node: CategoryNode): number =>
  node.productCount +
  node.children.reduce((sum, c) => sum + subtreeCount(c), 0);

/**
 * The category's own picture, at whatever size the caller needs.
 *
 * Categories are photographed — a switch, a rack, a camera — and the menu used a
 * single Layers glyph for every one of them, which made five different families
 * look like five copies of the same row. Where a category has no image yet, its
 * initial stands in rather than a broken frame.
 */
const CategoryPlate = ({
  node,
  size,
}: {
  node: CategoryNode;
  size: number;
}) => (
  <span
    className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-hairline bg-surface"
    style={{ width: size, height: size }}
  >
    {node.image ? (
      <Image
        src={documentImageUrl(node.image)}
        alt=""
        fill
        sizes={`${size}px`}
        className="object-contain p-1"
      />
    ) : (
      <span className="font-heading text-sm font-bold text-primary">
        {node.name.charAt(0)}
      </span>
    )}
  </span>
);

const TreeItem = ({
  node,
  depth,
  selectedUuid,
  openUuids,
  onSelect,
  onToggle,
  onNavigate,
}: TreeItemProps) => {
  const isSelected = selectedUuid === node.uuid;
  const isOpen = openUuids.has(node.uuid);
  const hasChildren = node.children.length > 0;

  // A family is a card; everything under it is a bulleted line inside that card's
  // block. Rendering all levels as identical rows made a three-deep tree read as
  // one long list of equals.
  if (depth > 0) {
    return (
      <li>
        <Link
          href={`/products?category=${node.uuid}`}
          onMouseEnter={() => onSelect(node)}
          onClick={onNavigate}
          className={cn(
            "font-grotesk flex items-center gap-2.5 rounded-lg py-1.5 pr-2 pl-4 text-sm transition-colors",
            isSelected ? "text-primary" : "text-secondary hover:text-primary",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              isSelected ? "bg-primary-solid" : "bg-hairline",
            )}
          />
          <span className="truncate">{node.name}</span>
        </Link>

        {hasChildren && (
          <ul className="space-y-0.5 pl-4">
            {node.children.map((child) => (
              <TreeItem
                key={child.uuid}
                node={child}
                depth={depth + 1}
                selectedUuid={selectedUuid}
                openUuids={openUuids}
                onSelect={onSelect}
                onToggle={onToggle}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li
      className={cn(
        "rounded-2xl border transition-colors",
        isSelected
          ? "border-primary/40 bg-primary-tint"
          : "border-hairline bg-surface hover:border-primary/30",
      )}
    >
      <div className="flex items-center gap-1">
        {/* The row is a link, not a button: clicking a family opens the catalogue
            already filtered to it, which is what a shopper who clicked a category
            was asking for. Hovering still previews it in the panel. */}
        <Link
          href={`/products?category=${node.uuid}`}
          onMouseEnter={() => onSelect(node)}
          onClick={onNavigate}
          className="flex flex-1 items-center gap-3 py-2.5 pr-1 pl-3 text-left"
        >
          <CategoryPlate node={node} size={36} />
          <span className="min-w-0">
            <span
              className={cn(
                "font-grotesk block truncate text-sm font-medium",
                isSelected ? "text-primary" : "text-ink",
              )}
            >
              {node.name}
            </span>
            <span className="font-grotesk block text-xs text-faint">
              {subtreeCount(node)} products
            </span>
          </span>
        </Link>

        {hasChildren && (
          <button
            type="button"
            onClick={() => onToggle(node.uuid)}
            aria-label={
              isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`
            }
            aria-expanded={isOpen}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-faint transition-colors hover:text-primary"
          >
            <ChevronDown
              size={16}
              className={cn("transition-transform", isOpen && "rotate-180")}
            />
          </button>
        )}
      </div>

      {isOpen && hasChildren && (
        <ul className="space-y-0.5 px-3 pb-3">
          {node.children.map((child) => (
            <TreeItem
              key={child.uuid}
              node={child}
              depth={depth + 1}
              selectedUuid={selectedUuid}
              openUuids={openUuids}
              onSelect={onSelect}
              onToggle={onToggle}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const ProductTile = ({ product }: ProductTileProps) => (
  <Link
    href={`/products/${product.slug}`}
    className="group flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-4 transition-colors hover:border-primary/40"
  >
    <span className="relative flex h-28 items-center justify-center overflow-hidden rounded-xl bg-surface-2">
      {product.image ? (
        <Image
          src={documentImageUrl(product.image)}
          alt=""
          fill
          sizes="200px"
          className="object-contain p-3"
        />
      ) : (
        <ImageOff size={20} className="text-faint" />
      )}
    </span>
    <span className="min-w-0">
      {product.brandName && (
        <span className="font-grotesk block text-xs font-bold tracking-wide text-primary uppercase">
          {product.brandName}
        </span>
      )}
      <span className="font-heading mt-0.5 block truncate text-sm font-bold text-ink group-hover:text-primary">
        {product.name}
      </span>
      <span className="font-grotesk mt-1 block text-xs text-faint">
        {formatPrice(product.price, product.currency)}
      </span>
    </span>
  </Link>
);

/**
 * The catalogue menu: the category tree down the left, and the products of
 * whichever category is highlighted filling the panel beside it.
 *
 * It used to be three columns of category names with a strip of three products
 * at the bottom — a directory of the tree, where the shopper still had to guess
 * which branch held what they wanted. Leading with the products answers that
 * question in the menu itself, and the tree becomes the way to change the answer.
 */
export const CategoryMenu = ({ categories }: CategoryMenuProps) => {
  const [activeTopUuid, setActiveTopUuid] = useState<string | null>(null);
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [openUuids, setOpenUuids] = useState<Set<string>>(() => new Set());
  // Products per category, filled the first time a category is looked at and kept
  // for the rest of the visit — hovering back and forth must not re-query.
  const [productsByUuid, setProductsByUuid] = useState<
    Record<string, ProductSummary[]>
  >({});
  const [loadingUuid, setLoadingUuid] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCategory = (node: CategoryNode) => {
    setSelectedUuid(node.uuid);
    if (productsByUuid[node.uuid]) {
      return;
    }
    setLoadingUuid(node.uuid);
    getMenuProducts(subtreeUuids(node))
      .then((rows) =>
        setProductsByUuid((current) => ({ ...current, [node.uuid]: rows })),
      )
      // A preview that fails is an empty panel, never a broken menu.
      .catch(() =>
        setProductsByUuid((current) => ({ ...current, [node.uuid]: [] })),
      )
      .finally(() => setLoadingUuid(null));
  };

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
  };

  const openMenu = (parent: CategoryNode) => {
    cancelClose();
    setActiveTopUuid(parent.uuid);
    // Opens on the first branch that actually stocks something, not simply the
    // first one: a menu whose whole right-hand side reads "nothing listed here
    // yet" the moment it opens teaches the shopper to stop opening it.
    const stocked = parent.children.find((child) => subtreeCount(child) > 0);
    const landing = stocked ?? parent.children[0] ?? parent;
    showCategory(landing);
    setOpenUuids(landing === parent ? new Set() : new Set([landing.uuid]));
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setActiveTopUuid(null), 120);
  };

  // Clicking a category navigates; the panel has to come down with it, or the
  // shopper lands on the filtered page behind a menu still covering it.
  const closeMenu = () => {
    cancelClose();
    setActiveTopUuid(null);
  };

  // One branch open at a time. Leaving them all open pushed the panel past the
  // bottom of the screen, so the products it exists to show scrolled out of view
  // behind a column of category names.
  const toggle = (uuid: string) =>
    setOpenUuids((current) =>
      current.has(uuid) ? new Set() : new Set([uuid]),
    );

  const activeTop = categories.find((c) => c.uuid === activeTopUuid) ?? null;

  const findNode = (nodes: CategoryNode[]): CategoryNode | null => {
    for (const node of nodes) {
      if (node.uuid === selectedUuid) {
        return node;
      }
      const found = findNode(node.children);
      if (found) {
        return found;
      }
    }
    return null;
  };
  const selected = activeTop ? (findNode([activeTop]) ?? activeTop) : null;
  const products = selected
    ? (productsByUuid[selected.uuid] ?? []).slice(0, 6)
    : [];
  const loading = selected ? loadingUuid === selected.uuid : false;

  return (
    // Appears at xl, not md. At 768-1279 the category row and the action
    // buttons together exceed the bar, and both wrapped inside its fixed
    // height — the labels overlapped the theme toggle.
    <div className="hidden xl:block">
      <div className="flex items-center gap-6 2xl:gap-9">
        {categories.map((parent) => (
          <button
            key={parent.uuid}
            type="button"
            onMouseEnter={() => openMenu(parent)}
            onMouseLeave={scheduleClose}
            className={cn(
              "font-grotesk relative flex h-18 items-center text-sm font-medium transition-colors",
              activeTopUuid === parent.uuid
                ? "text-primary"
                : "text-secondary hover:text-primary",
            )}
          >
            {parent.name}
            {activeTopUuid === parent.uuid && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary-solid" />
            )}
          </button>
        ))}
      </div>

      {activeTop && selected && (
        <div
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          // A ceiling and a scroll of its own: a family with several open
          // branches is taller than the viewport, and a menu that grows past the
          // bottom of the screen cannot be read to the end.
          className="fixed inset-x-0 top-18 z-40 flex max-h-[calc(100vh-4.5rem)] flex-col overflow-hidden border-b border-hairline bg-surface-2 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.5)]"
        >
          {/* The masthead sits on the panel's own surface, divided from the
              columns below by a hairline rather than by a colour. A violet
              field across the full width of the screen was louder than
              anything in the menu it was introducing. */}
          <div className="relative border-b border-hairline">
            {/* Low and to the right, hanging past the band the way a product
                shot overlaps a banner edge. The band therefore cannot clip its
                overflow, so the image is pointer-events-none and the copy is
                capped away from it. No drop shadow: these are cut-outs, and a
                shadow haloes the bounding box. */}
            {selected.image && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-0 -bottom-8 hidden h-52 w-1/2 lg:block"
              >
                <Image
                  src={documentImageUrl(selected.image)}
                  alt=""
                  fill
                  sizes="500px"
                  // Anchored to the bottom-right corner so the photograph runs
                  // off the edge of the band instead of sitting in a box inset
                  // from it.
                  className="object-contain object-right-bottom"
                />
              </div>
            )}

            <div className="relative flex w-full items-start gap-4 px-6 py-8 lg:px-12 xl:px-20">
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline bg-surface">
                {selected.image ? (
                  <Image
                    src={documentImageUrl(selected.image)}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-contain p-2.5"
                  />
                ) : (
                  <span className="font-heading text-xl font-bold text-primary-solid">
                    {selected.name.charAt(0)}
                  </span>
                )}
              </span>

              {/* Capped, so the copy never runs under the photograph. */}
              <div className="min-w-0 max-w-md">
                <h2 className="font-heading text-3xl text-ink">
                  {selected.name}
                </h2>
                <p className="font-grotesk text-sm text-faint">
                  {subtreeCount(selected)} products
                </p>
                {selected.description && (
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {selected.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* w-full, not mx-auto: the panel is a flex column now, and an auto
              margin there overrides stretch and sizes the row to its content —
              so the sidebar shifted whenever the product grid was empty. */}
          <div className="scrollbar-slim grid min-h-0 w-full flex-1 grid-cols-[260px_1fr] gap-8 overflow-y-auto px-6 pt-8 pb-6 lg:px-12 xl:px-20">
            <div>
              <p className="font-grotesk px-3 text-xs font-semibold tracking-widest text-faint uppercase">
                Categories
              </p>
              <ul className="mt-3 space-y-2">
                {activeTop.children.map((child) => (
                  <TreeItem
                    key={child.uuid}
                    node={child}
                    depth={0}
                    selectedUuid={selected.uuid}
                    openUuids={openUuids}
                    onSelect={showCategory}
                    onToggle={toggle}
                    onNavigate={closeMenu}
                  />
                ))}
              </ul>
            </div>

            <div>
              <p className="font-grotesk text-xs font-semibold tracking-widest text-faint uppercase">
                In {selected.name}
              </p>
              {loading ? (
                // Three empty plates in the grid the products will land in, so
                // the panel does not jump when they arrive.
                <div className="mt-3 grid grid-cols-3 gap-4">
                  {[0, 1, 2].map((slot) => (
                    <div
                      key={slot}
                      className="h-44 animate-pulse rounded-2xl border border-hairline bg-surface"
                    />
                  ))}
                </div>
              ) : products.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-4">
                  {products.map((product) => (
                    <ProductTile key={product.uuid} product={product} />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  Nothing listed here yet — browse the family to see what is
                  nearby.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
