import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";

type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, id, name, className = "", ...props }, ref) => {
    const checkboxId = id ?? name;

    return (
      <label
        htmlFor={checkboxId}
        className="flex w-fit cursor-pointer items-center gap-2 text-sm text-ink"
      >
        <input
          ref={ref}
          id={checkboxId}
          name={name}
          type="checkbox"
          className={`h-4 w-4 cursor-pointer rounded border-hairline text-primary focus:ring-primary ${className}`}
          {...props}
        />
        {label}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
