import type { InputHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { FormError } from "@/components/ui/form-error";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  labelIcon?: ReactNode;
  icon?: ReactNode;
  error?: string;
  wrapperClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      labelIcon,
      icon,
      error,
      wrapperClassName = "",
      id,
      name,
      className = "",
      ...props
    },
    ref,
  ) => {
    const inputId = id ?? name;

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={inputId}
            className="flex items-center gap-2 text-sm font-semibold text-ink"
          >
            {labelIcon && <span className="text-primary">{labelIcon}</span>}
            {label}
          </label>
        )}

        <div className={`relative ${wrapperClassName}`}>
          {icon && (
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint">
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            name={name}
            className={`w-full rounded-control border border-search-border bg-surface py-2.5 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-tint ${
              icon ? "pl-9 pr-3" : "px-3.5"
            } ${className}`}
            {...props}
          />
        </div>

        <FormError message={error} />
      </div>
    );
  },
);

Input.displayName = "Input";
