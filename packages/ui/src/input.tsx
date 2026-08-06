import type { InputHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { FormError } from "./form-error";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  labelIcon?: ReactNode;
  labelAccessory?: ReactNode;
  icon?: ReactNode;
  rightSlot?: ReactNode;
  error?: string;
  wrapperClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      labelIcon,
      labelAccessory,
      icon,
      rightSlot,
      error,
      wrapperClassName = "",
      id,
      name,
      required,
      className = "",
      ...props
    },
    ref,
  ) => {
    const inputId = id ?? name;

    return (
      <div className="flex flex-col gap-2">
        {(label || labelAccessory) && (
          <div className="flex items-center justify-between gap-2">
            {label && (
              <label
                htmlFor={inputId}
                className="flex items-center gap-2 text-sm font-medium text-ink"
              >
                {labelIcon && <span className="text-primary">{labelIcon}</span>}
                {label}
                {required && <span className="text-primary">*</span>}
              </label>
            )}
            {labelAccessory}
          </div>
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
            required={required}
            className={`w-full rounded-control border border-search-border bg-surface py-2.5 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-tint ${
              icon ? "pl-9" : "pl-3.5"
            } ${rightSlot ? "pr-11" : "pr-3.5"} ${className}`}
            {...props}
          />

          {rightSlot && (
            <span className="absolute top-1/2 right-3 -translate-y-1/2">
              {rightSlot}
            </span>
          )}
        </div>

        <FormError message={error} />
      </div>
    );
  },
);

Input.displayName = "Input";
