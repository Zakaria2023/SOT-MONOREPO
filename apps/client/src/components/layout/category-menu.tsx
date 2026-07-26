"use client";

import type { CategoryNode } from "@/lib/categories";
import { formatPrice } from "utils";
import { cn } from "@/lib/utils";
import { ChevronRight, Layers, Package } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

type CategoryMenuProps = {
  categories: CategoryNode[];
};

// The default leaf whose products preview when a parent first opens.
const defaultLeaf = (parent: CategoryNode): CategoryNode | null => {
  const firstChild = parent.children[0];
  if (!firstChild) {
    return null;
  }
  return firstChild.children[0] ?? firstChild;
};

export const CategoryMenu = ({ categories }: CategoryMenuProps) => {
  const [activeTopUuid, setActiveTopUuid] = useState<string | null>(null);
  const [activeLeafUuid, setActiveLeafUuid] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
  };

  const openMenu = (parent: CategoryNode) => {
    cancelClose();
    setActiveTopUuid(parent.uuid);
    setActiveLeafUuid(defaultLeaf(parent)?.uuid ?? null);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setActiveTopUuid(null), 120);
  };

  const activeTop = categories.find((c) => c.uuid === activeTopUuid) ?? null;
  const activeLeaf =
    activeTop?.children
      .flatMap((child) => [child, ...child.children])
      .find((node) => node.uuid === activeLeafUuid) ?? null;

  return (
    <div className="hidden md:block">
      <div className="flex items-center gap-9">
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
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {activeTop && (
        <div
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className="fixed inset-x-0 top-18 z-40 border-b border-hairline bg-surface-2 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.5)]"
        >
          <div className="mx-auto px-6 py-8 lg:px-12 xl:px-20">
            <p className="font-grotesk text-xs font-bold tracking-widest text-faint uppercase">
              {activeTop.name}
            </p>

            {activeTop.children.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-8 lg:grid-cols-3">
                {activeTop.children.map((child) => (
                  <div key={child.uuid}>
                    <Link
                      href={`/products?category=${child.uuid}`}
                      className="flex items-center gap-3"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-tint text-primary">
                        <Layers size={18} />
                      </span>
                      <div>
                        <p className="font-heading text-base font-bold text-ink transition-colors hover:text-primary">
                          {child.name}
                        </p>
                        <p className="font-grotesk text-xs text-faint">
                          {child.productCount} products
                        </p>
                      </div>
                    </Link>

                    {child.children.length > 0 && (
                      <ul className="mt-4 space-y-1">
                        {child.children.map((leaf) => (
                          <li key={leaf.uuid}>
                            <Link
                              href={`/products?category=${leaf.uuid}`}
                              onMouseEnter={() => setActiveLeafUuid(leaf.uuid)}
                              className={cn(
                                "font-grotesk flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                                activeLeafUuid === leaf.uuid
                                  ? "bg-primary-tint text-primary"
                                  : "text-secondary hover:text-primary",
                              )}
                            >
                              {leaf.name}
                              {activeLeafUuid === leaf.uuid && (
                                <ChevronRight size={16} />
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeLeaf && activeLeaf.products.length > 0 && (
              <div className="mt-8 border-t border-hairline pt-6">
                <p className="font-grotesk text-xs font-bold tracking-widest text-faint uppercase">
                  In stock{" "}
                  <span className="text-primary">{activeLeaf.name}</span>
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {activeLeaf.products.slice(0, 3).map((product) => (
                    <Link
                      key={product.uuid}
                      href={`/products/${product.slug}`}
                      className="flex items-center gap-3 rounded-xl border border-hairline p-3 transition-colors hover:border-primary/40"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
                        <Package size={18} />
                      </span>
                      <div>
                        {product.brandName && (
                          <p className="font-grotesk text-xs font-bold tracking-wide text-primary uppercase">
                            {product.brandName}
                          </p>
                        )}
                        <p className="font-heading text-sm font-bold text-ink">
                          {product.name}
                        </p>
                        <p className="font-grotesk text-xs text-faint">
                          {formatPrice(product.price, product.currency)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
