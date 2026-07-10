import type { ComponentType, InputHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { FormError } from "@/components/ui/form-error";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  labelAccessory?: ReactNode;
  icon?: ComponentType<{ size?: number; className?: string }>;
  rightSlot?: ReactNode;
  error?: string;
  wrapperClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      labelAccessory,
      icon: Icon,
      rightSlot,
      error,
      wrapperClassName = "",
      id,
      name,
      className = "",
      type = "text",
      ...props
    },
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

        <div className={cn("relative", wrapperClassName)}>
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
            type={type}
            className={cn(
              "font-grotesk w-full rounded-xl border border-[#E3E4E9] bg-white py-3 text-sm text-ink transition-colors placeholder:text-[#9A9DA5] focus:border-primary focus:outline-none",
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

        <FormError message={error} />
      </div>
    );
  },
);

Input.displayName = "Input";
