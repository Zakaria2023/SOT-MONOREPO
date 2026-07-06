import { cn } from "@/lib/utils";
import type { ComponentType, ReactNode } from "react";

type InputProps = {
  id: string;
  placeholder?: string;
  label?: string;
  type?: string;
  autoComplete?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  labelAccessory?: ReactNode;
  rightSlot?: ReactNode;
};

export const Input = ({
  id,
  placeholder,
  label,
  type = "text",
  autoComplete,
  icon: Icon,
  labelAccessory,
  rightSlot,
}: InputProps) => (
  <div>
    {(label || labelAccessory) && (
      <div className="mb-2 flex items-center justify-between">
        {label && (
          <label
            htmlFor={id}
            className="font-grotesk text-sm font-bold text-ink"
          >
            {label}
          </label>
        )}
        {labelAccessory}
      </div>
    )}

    <div className="relative">
      {Icon && (
        <Icon
          size={16}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[#8A8F98]"
        />
      )}
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn(
          "font-grotesk w-full rounded-xl border border-[#E3E4E9] bg-white py-3 text-sm text-ink transition-colors placeholder:text-[#9A9DA5] focus:border-primary focus:outline-none",
          Icon ? "pl-10" : "pl-3.5",
          rightSlot ? "pr-11" : "pr-3.5",
        )}
      />
      {rightSlot && (
        <div className="absolute top-1/2 right-3 -translate-y-1/2">
          {rightSlot}
        </div>
      )}
    </div>
  </div>
);
