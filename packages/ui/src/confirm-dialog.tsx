"use client";

import { Trash2, TriangleAlert, X } from "lucide-react";
import { useId } from "react";
import { Button } from "./button";
import { FormError } from "./form-error";
import { useFocusTrap } from "./use-focus-trap";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  isConfirming?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  isConfirming = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useFocusTrap<HTMLDivElement>(open, () => {
    if (!isConfirming) {
      onCancel();
    }
  });

  if (!open) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="animate-scale-in w-full max-w-sm rounded-card border border-hairline bg-surface p-6 shadow-xl outline-none"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger">
            <TriangleAlert size={20} />
          </div>

          <div className="flex flex-col gap-1 text-left">
            <h2
              id={titleId}
              className="font-heading text-lg font-semibold text-ink"
            >
              {title}
            </h2>
            <p id={descriptionId} className="text-sm text-muted">
              {description}
            </p>
          </div>
        </div>

        <FormError message={error} />

        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isConfirming}
          >
            <X size={16} />
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            disabled={isConfirming}
          >
            <Trash2 size={16} />
            {isConfirming ? "Deleting..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
