"use client";

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
};

type ProductTileProps = {
  product: ProductSummary;
};

// Every product under a node, not just the ones filed directly against it:
// products sit in the leaves, so a family would otherwise preview as empty.
const subtreeProducts = (node: CategoryNode): ProductSummary[] => [
  ...node.products,
  ...node.children.flatMap(subtreeProducts),
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
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const landing = stocked ?? parent.children[0];
    setSelectedUuid(landing?.uuid ?? parent.uuid);
    setOpenUuids(landing ? new Set([landing.uuid]) : new Set());
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setActiveTopUuid(null), 120);
  };

  const toggle = (uuid: string) =>
    setOpenUuids((current) => {
      const next = new Set(current);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      return next;
    });

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
  const products = selected ? subtreeProducts(selected).slice(0, 6) : [];

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
          className="fixed inset-x-0 top-18 z-40 border-b border-hairline bg-surface-2 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.5)]"
        >
          {/* The masthead is a band, and the selected category's photograph is
              the thing on it: once in a white disc beside the name, and once
              large, hanging past the band's bottom edge. */}
          <div className="relative bg-category-hero">
            {/* Low and to the right, hanging past the band the way a product
                shot overlaps a banner edge. The band therefore cannot clip its
                overflow, so the image is pointer-events-none and the copy is
                capped away from it. No drop shadow: these are cut-outs on a
                coloured field, and a shadow haloes the bounding box. */}
            {selected.image && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-12 -bottom-5 hidden h-36 w-80 lg:block xl:right-20"
              >
                <Image
                  src={documentImageUrl(selected.image)}
                  alt=""
                  fill
                  sizes="500px"
                  className="object-contain object-bottom"
                />
              </div>
            )}

            <div className="relative mx-auto flex items-start gap-4 px-6 py-12 lg:px-12 xl:px-20">
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
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
                <h2 className="font-heading text-3xl text-white">
                  {selected.name}
                </h2>
                <p className="font-grotesk text-sm text-white/70">
                  {subtreeCount(selected)} products
                </p>
                {selected.description && (
                  <p className="mt-3 text-sm leading-relaxed text-white/85">
                    {selected.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mx-auto grid grid-cols-[260px_1fr] gap-8 px-6 pt-8 pb-6 lg:px-12 xl:px-20">
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
                    onSelect={(node) => setSelectedUuid(node.uuid)}
                    onToggle={toggle}
                  />
                ))}
              </ul>
            </div>

            <div>
              <p className="font-grotesk text-xs font-semibold tracking-widest text-faint uppercase">
                In {selected.name}
              </p>
              {products.length > 0 ? (
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
