"use client";

import { ChevronDown, CornerDownRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";

export type DropdownOption = {
  value: string;
  label: string;
  depth?: number;
};

type DropdownProps = {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

export const Dropdown = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
}: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

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

  const handleToggle = () => {
    if (!isOpen) updatePosition();
    setIsOpen((open) => !open);
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={handleToggle}
        className="w-full justify-between text-left font-normal outline-none focus:border-primary"
      >
        <span>{selectedLabel}</span>
        <ChevronDown size={16} className="text-faint" />
      </Button>

      {isOpen &&
        position &&
        createPortal(
          <ul
            ref={menuRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            className="z-50 max-h-72 overflow-y-auto rounded-control border border-hairline bg-surface shadow-lg"
          >
            {options.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  style={{ paddingLeft: 12 + (option.depth ?? 0) * 16 }}
                  className={`flex w-full cursor-pointer items-center gap-1.5 py-2 pr-3 text-left text-sm hover:bg-hover ${
                    option.value === value
                      ? "bg-primary-tint font-semibold text-primary"
                      : "text-ink"
                  }`}
                >
                  {(option.depth ?? 0) > 0 && (
                    <CornerDownRight size={14} className="shrink-0 text-faint" />
                  )}
                  {option.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
};
