import type { ReactNode, TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { FormError } from "@/components/ui/form-error";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  labelIcon?: ReactNode;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, labelIcon, error, id, name, className = "", ...props }, ref) => {
    const textareaId = id ?? name;

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={textareaId}
            className="flex items-center gap-2 text-sm font-semibold text-ink"
          >
            {labelIcon && <span className="text-primary">{labelIcon}</span>}
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          name={name}
          className={`w-full rounded-control border border-search-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-tint ${className}`}
          {...props}
        />

        <FormError message={error} />
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
