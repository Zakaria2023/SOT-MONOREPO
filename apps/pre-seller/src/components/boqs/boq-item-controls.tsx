"use client";

import { removeItem, updateItemQuantity } from "@/app/boqs/[uuid]/actions";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useTransition } from "react";

type BoqItemControlsProps = {
  boqUuid: string;
  boqItemUuid: string;
  quantity: number;
};

export const BoqItemControls = ({
  boqUuid,
  boqItemUuid,
  quantity,
}: BoqItemControlsProps) => {
  const [isPending, startTransition] = useTransition();

  const setQuantity = (next: number) =>
    startTransition(() => {
      void updateItemQuantity(boqUuid, boqItemUuid, next);
    });

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-lg border border-neutral-200">
        <button
          type="button"
          aria-label="Decrease quantity"
          disabled={isPending || quantity <= 1}
          onClick={() => setQuantity(quantity - 1)}
          className="p-2 text-neutral-500 transition-colors hover:text-ink disabled:opacity-40"
        >
          <Minus size={14} />
        </button>
        <span className="w-8 text-center text-sm font-medium tabular-nums text-ink">
          {quantity}
        </span>
        <button
          type="button"
          aria-label="Increase quantity"
          disabled={isPending}
          onClick={() => setQuantity(quantity + 1)}
          className="p-2 text-neutral-500 transition-colors hover:text-ink disabled:opacity-40"
        >
          <Plus size={14} />
        </button>
      </div>

      <button
        type="button"
        aria-label="Remove item"
        disabled={isPending}
        onClick={() =>
          startTransition(() => {
            void removeItem(boqUuid, boqItemUuid);
          })
        }
        className="p-2 text-neutral-400 transition-colors hover:text-red-600 disabled:opacity-40"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};
