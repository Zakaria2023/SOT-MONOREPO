"use client";

import { Trash2, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

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
  if (!open) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="animate-scale-in w-full max-w-sm rounded-card border border-hairline bg-surface p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger">
            <TriangleAlert size={20} />
          </div>

          <div className="flex flex-col gap-1 text-left">
            <h2 className="font-heading text-lg font-bold text-ink">
              {title}
            </h2>
            <p className="text-sm text-muted">{description}</p>
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
