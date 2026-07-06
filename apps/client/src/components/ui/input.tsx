import { cn } from "@/lib/utils";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentType,
  type ReactNode,
} from "react";

type InputProps = ComponentPropsWithoutRef<"input"> & {
  label?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  labelAccessory?: ReactNode;
  rightSlot?: ReactNode;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, icon: Icon, labelAccessory, rightSlot, error, id, name, className, ...props },
    ref,
  ) => {
    const inputId = id ?? name;

    return (
      <div>
        {(label || labelAccessory) && (
          <div className="mb-2 flex items-center justify-between">
            {label && (
              <label
                htmlFor={inputId}
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
            ref={ref}
            id={inputId}
            name={name}
            className={cn(
              "font-grotesk w-full rounded-xl border bg-white py-3 text-sm text-ink transition-colors placeholder:text-[#9A9DA5] focus:outline-none",
              error
                ? "border-red-400 focus:border-red-500"
                : "border-[#E3E4E9] focus:border-primary",
              Icon ? "pl-10" : "pl-3.5",
              rightSlot ? "pr-11" : "pr-3.5",
              className,
            )}
            {...props}
          />
          {rightSlot && (
            <div className="absolute top-1/2 right-3 -translate-y-1/2">
              {rightSlot}
            </div>
          )}
        </div>

        {error && (
          <p className="font-grotesk mt-1.5 text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
