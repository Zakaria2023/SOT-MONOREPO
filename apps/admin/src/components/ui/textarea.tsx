import type { TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { FormError } from "@/components/ui/form-error";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, id, name, className = "", ...props }, ref) => {
    const textareaId = id ?? name;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-semibold text-ink">
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          name={name}
          className={`w-full rounded-control border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary ${className}`}
          {...props}
        />

        <FormError message={error} />
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
