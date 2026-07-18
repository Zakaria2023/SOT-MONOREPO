"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Search,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";

export type DropdownOption = {
  value: string;
  label: string;
  depth?: number;
};

type DropdownBaseProps = {
  options: DropdownOption[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
};

type SingleDropdownProps = DropdownBaseProps & {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
};

type MultiDropdownProps = DropdownBaseProps & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
};

type DropdownProps = SingleDropdownProps | MultiDropdownProps;

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

export const Dropdown = (props: DropdownProps) => {
  const {
    options,
    placeholder = "Select...",
    searchable = false,
    searchPlaceholder = "Search...",
    emptyMessage = "No results",
  } = props;
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Index of the keyboard-highlighted row among the currently rendered rows.
  const [activeIndex, setActiveIndex] = useState(0);
  // Tree parents start collapsed so the menu doesn't dump the whole tree.
  // A parent is any option immediately followed by a deeper-depth option.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (let i = 0; i < options.length; i++) {
      const depth = options[i].depth ?? 0;
      const next = options[i + 1];
      if (next && (next.depth ?? 0) > depth) {
        set.add(options[i].value);
      }
    }
    return set;
  });
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Anchor the portalled menu to the trigger in viewport coordinates.
  const updatePosition = useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  // Keep it anchored while open (scroll uses capture to catch any ancestor).
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const reposition = () => updatePosition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [isOpen, updatePosition]);

  // Focus the search field as soon as a searchable menu opens.
  useEffect(() => {
    if (isOpen && searchable) {
      searchRef.current?.focus();
    }
  }, [isOpen, searchable]);

  // Close on a click that lands outside both the trigger and the menu.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isSelected = (optionValue: string) =>
    props.multiple
      ? props.value.includes(optionValue)
      : props.value === optionValue;

  const triggerLabel = (() => {
    if (props.multiple) {
      const selected = options.filter((option) =>
        props.value.includes(option.value),
      );
      if (selected.length === 0) return placeholder;
      if (selected.length <= 2) {
        return selected.map((option) => option.label).join(", ");
      }
      return `${selected.length} selected`;
    }
    return (
      options.find((option) => option.value === props.value)?.label ??
      placeholder
    );
  })();

  const isPlaceholder = triggerLabel === placeholder;

  // Rows to render: while searching, a flat list of label matches (no tree,
  // no collapse). Otherwise the tree with collapsed parents' subtrees hidden.
  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term) {
      return options
        .filter((option) => option.label.toLowerCase().includes(term))
        .map((option) => ({
          option: { ...option, depth: 0 },
          hasChildren: false,
          isCollapsed: false,
        }));
    }

    const result: {
      option: DropdownOption;
      hasChildren: boolean;
      isCollapsed: boolean;
    }[] = [];
    // While inside a collapsed subtree, skip every deeper option until we come
    // back out to the collapsed parent's depth (or shallower).
    let hideDepth: number | null = null;
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      const depth = option.depth ?? 0;
      if (hideDepth !== null) {
        if (depth > hideDepth) {
          continue;
        }
        hideDepth = null;
      }
      const next = options[i + 1];
      const hasChildren = next ? (next.depth ?? 0) > depth : false;
      const isCollapsed = collapsed.has(option.value);
      result.push({ option, hasChildren, isCollapsed });
      if (hasChildren && isCollapsed) {
        hideDepth = depth;
      }
    }
    return result;
  }, [options, query, collapsed]);

  const toggleCollapse = (value: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });

  // The highlighted row, clamped to the rows currently rendered.
  const active = rows.length > 0 ? Math.min(activeIndex, rows.length - 1) : -1;

  // Keep the highlighted row scrolled into view as the user arrows through.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    menuRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [isOpen, active]);

  const handleToggle = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen((open) => !open);
    setQuery("");
    setActiveIndex(0);
  };

  const handleSelect = (optionValue: string) => {
    if (props.multiple) {
      props.onChange(
        props.value.includes(optionValue)
          ? props.value.filter((current) => current !== optionValue)
          : [...props.value, optionValue],
      );
      // Stay open so several options can be toggled in one pass.
      return;
    }
    props.onChange(optionValue);
    setIsOpen(false);
    setQuery("");
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isOpen) {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        event.preventDefault();
        handleToggle();
      }
      return;
    }

    const row = active >= 0 ? rows[active] : undefined;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex(Math.min(active + 1, rows.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex(Math.max(active - 1, 0));
        break;
      case "Enter":
        event.preventDefault();
        if (row) {
          handleSelect(row.option.value);
        }
        break;
      case "Escape":
        event.preventDefault();
        setIsOpen(false);
        break;
      case "ArrowRight":
        if (row?.hasChildren && row.isCollapsed) {
          event.preventDefault();
          toggleCollapse(row.option.value);
        }
        break;
      case "ArrowLeft":
        if (row?.hasChildren && !row.isCollapsed) {
          event.preventDefault();
          toggleCollapse(row.option.value);
        }
        break;
      default:
        break;
    }
  };

  const activeOptionId = active >= 0 ? `${listboxId}-opt-${active}` : undefined;

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={
          isOpen && !searchable ? activeOptionId : undefined
        }
        className="w-full justify-between text-left font-normal outline-none focus:border-primary"
      >
        <span className={isPlaceholder ? "text-faint" : ""}>
          {triggerLabel}
        </span>
        <ChevronDown size={16} className="text-faint" />
      </Button>

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            className="z-50 overflow-hidden rounded-control border border-hairline bg-overlay shadow-lg"
          >
            {searchable && (
              <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
                <Search size={15} className="shrink-0 text-faint" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={searchPlaceholder}
                  role="combobox"
                  aria-controls={listboxId}
                  aria-expanded={isOpen}
                  aria-activedescendant={activeOptionId}
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
                />
              </div>
            )}

            <ul
              id={listboxId}
              role="listbox"
              aria-multiselectable={props.multiple ? true : undefined}
              className="max-h-72 overflow-y-auto"
            >
              {rows.length === 0 ? (
                <li className="px-3 py-2 text-sm text-faint">{emptyMessage}</li>
              ) : (
                rows.map(({ option, hasChildren, isCollapsed }, index) => {
                  const selected = isSelected(option.value);
                  const isActive = index === active;
                  return (
                    <li key={option.value}>
                      <div
                        className={`flex items-center ${
                          selected
                            ? "bg-primary-tint text-primary"
                            : isActive
                              ? "bg-hover text-ink"
                              : "text-ink hover:bg-hover"
                        }`}
                      >
                        <button
                          type="button"
                          id={`${listboxId}-opt-${index}`}
                          role="option"
                          aria-selected={selected}
                          data-active={isActive ? "true" : undefined}
                          onClick={() => handleSelect(option.value)}
                          onMouseEnter={() => setActiveIndex(index)}
                          style={{ paddingLeft: 12 + (option.depth ?? 0) * 16 }}
                          className={`flex flex-1 cursor-pointer items-center gap-1.5 py-2 pr-3 text-left text-sm ${
                            selected ? "font-semibold" : ""
                          }`}
                        >
                          {(option.depth ?? 0) > 0 && !hasChildren && (
                            <CornerDownRight
                              size={14}
                              className="shrink-0 text-faint"
                            />
                          )}
                          <span className="flex-1">{option.label}</span>
                          {props.multiple && selected && (
                            <Check size={15} className="shrink-0 text-primary" />
                          )}
                        </button>

                        {hasChildren && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleCollapse(option.value);
                            }}
                            aria-label={
                              isCollapsed
                                ? `Expand ${option.label}`
                                : `Collapse ${option.label}`
                            }
                            className="flex h-8 w-8 shrink-0 items-center justify-center text-faint hover:text-ink"
                          >
                            <ChevronRight
                              size={15}
                              className={`transition-transform ${
                                isCollapsed ? "" : "rotate-90"
                              }`}
                            />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
};
