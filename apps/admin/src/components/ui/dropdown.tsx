"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

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

export const Dropdown = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
}: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? placeholder;

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen((open) => !open)}
        className="w-full justify-between text-left font-normal outline-none focus:border-primary"
      >
        <span>{selectedLabel}</span>
        <ChevronDown size={16} className="text-faint" />
      </Button>

      {isOpen && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-control border border-hairline bg-surface shadow-lg">
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={{ paddingLeft: 12 + (option.depth ?? 0) * 16 }}
                className={`block w-full cursor-pointer py-2 pr-3 text-left text-sm hover:bg-hover ${
                  option.value === value
                    ? "bg-primary-tint font-semibold text-primary"
                    : "text-ink"
                }`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
