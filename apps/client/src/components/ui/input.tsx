import type { InputHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { FormError } from "@/components/ui/form-error";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  icon?: ReactNode;
  error?: string;
  wrapperClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, icon, error, wrapperClassName = "", id, name, className = "", ...props },
    ref,
  ) => {
    const inputId = id ?? name;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-ink">
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
            className={`w-full rounded-control border border-search-border bg-surface py-2 text-sm text-ink outline-none focus:border-primary ${
              icon ? "pl-9 pr-3" : "px-3"
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
