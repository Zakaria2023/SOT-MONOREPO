"use client";

import { Check, ChevronDown, CornerDownRight, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
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

  // Filter by label while searching. During an active query the tree is flat,
  // so drop the depth indentation to avoid orphaned-looking indents.
  const visibleOptions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options
      .filter((option) => option.label.toLowerCase().includes(term))
      .map((option) => ({ ...option, depth: 0 }));
  }, [options, query]);

  const handleToggle = () => {
    if (!isOpen) updatePosition();
    setIsOpen((open) => !open);
    setQuery("");
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

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={handleToggle}
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
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
                />
              </div>
            )}

            <ul className="max-h-72 overflow-y-auto">
              {visibleOptions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-faint">{emptyMessage}</li>
              ) : (
                visibleOptions.map((option) => {
                  const selected = isSelected(option.value);
                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        onClick={() => handleSelect(option.value)}
                        style={{ paddingLeft: 12 + (option.depth ?? 0) * 16 }}
                        className={`flex w-full cursor-pointer items-center gap-1.5 py-2 pr-3 text-left text-sm hover:bg-hover ${
                          selected
                            ? "bg-primary-tint font-semibold text-primary"
                            : "text-ink"
                        }`}
                      >
                        {(option.depth ?? 0) > 0 && (
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
