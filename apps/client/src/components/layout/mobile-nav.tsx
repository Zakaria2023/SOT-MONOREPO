"use client";

import type { CategoryNode } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { ChevronDown, Layers, Menu, Package, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "ui";

// Must match --animate-drawer-out in globals.css. The panel has to stay mounted
// for the whole exit or there is nothing left to animate — closing by unmounting
// immediately is why a drawer usually has no close animation at all.
const EXIT_MS = 180;

type MobileNavProps = {
  categories: CategoryNode[];
  isSignedIn: boolean;
};

type BranchProps = {
  node: CategoryNode;
  onNavigate: () => void;
};

// One expandable top-level branch. Tapping the row toggles it; the row's own
// label is a link too, so a parent category is still reachable in one tap
// rather than only through its children.
const Branch = ({ node, onNavigate }: BranchProps) => {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div className="flex items-center">
        <Link
          href={`/products?category=${node.uuid}`}
          onClick={onNavigate}
          className="font-grotesk flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-hover"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
            <Layers size={16} />
          </span>
          <span className="flex-1">{node.name}</span>
          {/* Suppressed at zero. productCount is direct products only, so a
              parent that organises children rather than holding stock itself
              would otherwise read as an empty category. */}
          {node.productCount > 0 && (
            <span className="font-grotesk text-xs text-faint">
              {node.productCount}
            </span>
          )}
        </Link>

        {hasChildren && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`}
            className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ChevronDown
              size={16}
              className={cn("transition-transform", open && "rotate-180")}
            />
          </button>
        )}
      </div>

      {hasChildren && open && (
        <ul className="mt-1 ml-6 space-y-0.5 border-l border-hairline pl-3">
          {node.children.map((child) => (
            <li key={child.uuid}>
              <Link
                href={`/products?category=${child.uuid}`}
                onClick={onNavigate}
                className="font-grotesk flex items-center justify-between rounded-lg px-3 py-2 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary"
              >
                {child.name}
                {child.productCount > 0 && (
                  <span className="text-xs text-faint">
                    {child.productCount}
                  </span>
                )}
              </Link>

              {child.children.length > 0 && (
                <ul className="mt-0.5 ml-3 space-y-0.5">
                  {child.children.map((leaf) => (
                    <li key={leaf.uuid}>
                      <Link
                        href={`/products?category=${leaf.uuid}`}
                        onClick={onNavigate}
                        className="font-grotesk flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-faint transition-colors hover:bg-hover hover:text-primary"
                      >
                        <Package size={13} className="shrink-0" />
                        {leaf.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

export const MobileNav = ({ categories, isSignedIn }: MobileNavProps) => {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDrawer = () => {
    if (exitTimer.current) {
      clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
    setClosing(false);
    setOpen(true);
  };

  // Every link in here closes on click, which is also what dismisses the drawer
  // on navigation — this component is not unmounted by a route change, so
  // without that the drawer would sit open over the page it just opened.
  const close = () => {
    // Guard against a second close during the exit, which would queue a
    // duplicate timer and unmount the next opening early.
    if (closing) {
      return;
    }
    setClosing(true);
    exitTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
      exitTimer.current = null;
    }, EXIT_MS);
  };

  useEffect(
    () => () => {
      if (exitTimer.current) {
        clearTimeout(exitTimer.current);
      }
    },
    [],
  );

  // Released as soon as the exit starts, so the page is interactive again for
  // the 180ms the panel spends sliding out.
  const drawerRef = useFocusTrap<HTMLDivElement>(open && !closing, close);

  // The drawer scrolls on its own; letting the page scroll underneath it makes
  // the whole thing feel detached on a phone.
  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        aria-label="Open menu"
        aria-expanded={open && !closing}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-search-border text-secondary transition-colors hover:bg-surface-2 hover:text-primary xl:hidden"
      >
        <Menu size={18} />
      </button>

      {/* Portalled to <body> rather than left where it sits in the tree. The
          navbar's <header> carries `backdrop-blur-xl`, and an element with a
          backdrop-filter becomes the containing block for fixed-position
          descendants — so `fixed inset-0` measured itself against the 72px
          navbar instead of the viewport, and the panel's background stopped
          72px down while its contents spilled over the page. */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-60 xl:hidden">
            <div
              className={cn(
                "absolute inset-0 bg-black/50",
                closing ? "animate-scrim-out" : "animate-scrim-in",
              )}
              onClick={close}
              aria-hidden="true"
            />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              tabIndex={-1}
              className={cn(
                "absolute inset-y-0 right-0 flex w-80 max-w-[88%] flex-col bg-page shadow-2xl outline-none",
                closing ? "animate-drawer-out" : "animate-drawer-in",
              )}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-3.5">
                <span className="font-heading text-lg text-ink">Browse</span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close menu"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-2 py-3">
                {categories.length === 0 ? (
                  <p className="font-grotesk px-3 py-6 text-center text-sm text-faint">
                    No categories yet.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {categories.map((node) => (
                      <Branch key={node.uuid} node={node} onNavigate={close} />
                    ))}
                  </ul>
                )}
              </nav>

              <div className="shrink-0 border-t border-hairline px-2 py-3">
                <Link
                  href="/products"
                  onClick={close}
                  className="font-grotesk flex items-center justify-center rounded-control bg-primary-solid px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-solid-hover"
                >
                  View the full catalog
                </Link>

                <div className="mt-2 flex flex-col">
                  <Link
                    href="/categories"
                    onClick={close}
                    className="font-grotesk rounded-lg px-3 py-2 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary"
                  >
                    Shop by solution
                  </Link>
                  <Link
                    href="/brands"
                    onClick={close}
                    className="font-grotesk rounded-lg px-3 py-2 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary"
                  >
                    Brands
                  </Link>
                  {isSignedIn ? (
                    <>
                      <Link
                        href="/offers"
                        onClick={close}
                        className="font-grotesk rounded-lg px-3 py-2 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary"
                      >
                        Your offers
                      </Link>
                      <Link
                        href="/orders"
                        onClick={close}
                        className="font-grotesk rounded-lg px-3 py-2 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary"
                      >
                        Your orders
                      </Link>
                      <Link
                        href="/support"
                        onClick={close}
                        className="font-grotesk rounded-lg px-3 py-2 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary"
                      >
                        Support
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/partner"
                        onClick={close}
                        className="font-grotesk rounded-lg px-3 py-2 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary"
                      >
                        Become a partner
                      </Link>
                      <Link
                        href="/sign-in"
                        onClick={close}
                        className="font-grotesk rounded-lg px-3 py-2 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary"
                      >
                        Sign in
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
