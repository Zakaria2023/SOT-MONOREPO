"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProduct } from "@/app/(dashboard)/products/action";
import { Button } from "ui";
import { ConfirmDialog } from "ui";

type ProductRowActionsProps = {
  uuid: string;
  name: string;
};

export const ProductRowActions = ({ uuid, name }: ProductRowActionsProps) => {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isDeleting, startTransition] = useTransition();

  const handleConfirmDelete = () => {
    startTransition(async () => {
      const result = await deleteProduct(uuid);

      if (result.error) {
        setError(result.error);
        return;
      }

      setIsConfirmOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={`/products/${uuid}`}
        aria-label={`View ${name}`}
        className="flex h-9 w-9 items-center justify-center rounded-control border border-hairline text-secondary hover:bg-hover"
      >
        <Eye size={16} />
      </Link>

      <Link
        href={`/products/${uuid}/edit`}
        aria-label={`Edit ${name}`}
        className="flex h-9 w-9 items-center justify-center rounded-control border border-hairline text-secondary hover:bg-hover"
      >
        <Pencil size={16} />
      </Link>

      <Button
        type="button"
        variant="icon"
        className="h-9 w-9"
        onClick={() => {
          setError(undefined);
          setIsConfirmOpen(true);
        }}
      >
        <Trash2 size={16} />
      </Button>

      <ConfirmDialog
        open={isConfirmOpen}
        title="Delete product"
        description={`Are you sure you want to delete "${name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isConfirming={isDeleting}
        error={error}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
};
