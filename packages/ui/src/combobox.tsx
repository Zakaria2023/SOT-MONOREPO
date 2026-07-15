"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";

export type ComboboxOption = {
  value: string;
  label: string;
};

type ComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

export const Combobox = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results",
  disabled = false,
}: ComboboxProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Anchor the portalled menu to the trigger in viewport coordinates.
  const updatePosition = useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  // Keep it anchored while open (scroll uses capture to catch any ancestor).
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    updatePosition();

    const reposition = () => updatePosition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [isOpen, updatePosition]);

  // Focus the search field as soon as the menu opens.
  useEffect(() => {
    if (isOpen) {
      searchRef.current?.focus();
    }
  }, [isOpen]);

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

  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? placeholder;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return options;
    }
    return options.filter((option) =>
      option.label.toLowerCase().includes(term),
    );
  }, [options, query]);

  const close = () => {
    setIsOpen(false);
    setQuery("");
  };

  const handleToggle = () => {
    if (disabled) {
      return;
    }
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen((open) => !open);
    setQuery("");
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    close();
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={handleToggle}
        disabled={disabled}
        className="w-full justify-between text-left font-normal outline-none focus:border-primary"
      >
        <span className={value ? "" : "text-faint"}>{selectedLabel}</span>
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

            <ul className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-faint">{emptyMessage}</li>
              ) : (
                filtered.map((option) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-hover ${
                        option.value === value
                          ? "bg-primary-tint font-semibold text-primary"
                          : "text-ink"
                      }`}
                    >
                      {option.label}
                      {option.value === value && (
                        <Check size={15} className="shrink-0 text-primary" />
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
};
