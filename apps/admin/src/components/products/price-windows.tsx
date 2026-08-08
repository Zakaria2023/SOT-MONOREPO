"use client";

import {
  addProductPriceAction,
  closeProductPriceAction,
  deleteProductPriceAction,
  listProductPricesAction,
} from "@/app/(dashboard)/products/action";
import type { SelectProductPrices } from "services";
import { CircleDot, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { formatPrice } from "utils";
import { Button, Input } from "ui";

// ---------------------------------------------------------------------------
// WHAT THIS PRODUCT COSTS, AND SINCE WHEN.
//
// The screen that makes the catalogue sellable: an unpriced line is refused at
// the order gate, and until now nothing anywhere could enter a price with a date
// on it.
//
// Closing and deleting are deliberately different buttons. A price that applied
// last month is a fact about the orders placed last month, and deleting the row
// would leave those orders unexplainable — so closing is for a price that has
// genuinely ended, and deleting is for a row somebody typed wrong.
// ---------------------------------------------------------------------------

type PriceWindowsProps = {
  productUuid: string;
  currency: string;
};

type WindowRowProps = {
  row: SelectProductPrices;
  productUuid: string;
  onChanged: () => void;
};

// `datetime-local` wants exactly this, and an ISO string with a Z on it silently
// renders blank.
const toLocalInput = (date: Date): string =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

const WindowRow = ({ row, productUuid, onChanged }: WindowRowProps) => {
  const [pending, startTransition] = useTransition();
  const open = row.effectiveTo === null;

  const close = (): void => {
    startTransition(async () => {
      await closeProductPriceAction(
        row.uuid,
        productUuid,
        new Date().toISOString(),
      );
      onChanged();
    });
  };

  const remove = (): void => {
    startTransition(async () => {
      await deleteProductPriceAction(row.uuid, productUuid);
      onChanged();
    });
  };

  return (
    <div className="flex items-start justify-between gap-3 rounded-control border border-hairline bg-base px-2.5 py-2">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm text-ink">
          {open && (
            <CircleDot size={12} className="shrink-0 text-emerald-400" />
          )}
          {formatPrice(row.price, row.currency)}
        </p>
        <p className="text-[11px] text-muted">
          {new Date(row.effectiveFrom).toLocaleDateString()} →{" "}
          {open ? "still in force" : new Date(row.effectiveTo ?? 0).toLocaleDateString()}
          {row.actorName && ` · ${row.actorName}`}
        </p>
        {row.note && <p className="text-[11px] text-secondary">{row.note}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {open && (
          <button
            type="button"
            onClick={close}
            disabled={pending}
            className="rounded-control border border-hairline px-1.5 py-0.5 text-[11px] text-secondary hover:bg-hover hover:text-ink disabled:opacity-60"
          >
            End it now
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          aria-label="Delete this price"
          className="rounded-control p-1.5 text-faint hover:bg-hover hover:text-red-400 disabled:opacity-60"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

export const PriceWindows = ({ productUuid, currency }: PriceWindowsProps) => {
  const [rows, setRows] = useState<SelectProductPrices[]>();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [from, setFrom] = useState(() => toLocalInput(new Date()));
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const load = (): void => {
    listProductPricesAction(productUuid).then(setRows);
  };

  useEffect(load, [productUuid]);

  const save = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await addProductPriceAction({
        productUuid,
        price,
        currency,
        effectiveFrom: new Date(from).toISOString(),
        effectiveTo: to ? new Date(to).toISOString() : null,
        note: note.trim() || null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setPrice("");
      setTo("");
      setNote("");
      load();
    });
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      {rows?.length === 0 && (
        <p className="rounded-control border border-dashed border-hairline px-3 py-4 text-center text-[11px] text-faint">
          No dated price. Until one exists this product cannot be ordered — the
          gate refuses an unpriced line rather than selling it for nothing.
        </p>
      )}

      {rows?.map((row) => (
        <WindowRow
          key={row.uuid}
          row={row}
          productUuid={productUuid}
          onChanged={load}
        />
      ))}

      {open ? (
        <div className="flex flex-col gap-3 rounded-card border border-primary/40 bg-surface p-3">
          <Input
            label={`Price (${currency})`}
            type="number"
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="In force from"
              type="datetime-local"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
            <Input
              label="Until (blank = still in force)"
              type="datetime-local"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <Input
            label="Why"
            placeholder="July list increase"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />

          {error && (
            <p className="rounded-control border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400">
              {error}
            </p>
          )}

          {/* Said out loud, because it is the one thing about this screen that
              would otherwise surprise somebody correcting a price. */}
          <p className="text-[11px] text-muted">
            You do not have to close the old price first. Where two windows
            overlap, the one that starts later wins.
          </p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-control px-3 py-2 text-xs text-secondary hover:bg-hover hover:text-ink"
            >
              Cancel
            </button>
            <Button onClick={save} disabled={pending || price === ""}>
              {pending ? "Saving…" : "Set this price"}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center justify-center gap-1.5 rounded-control border border-hairline px-3 py-2 text-xs text-secondary hover:bg-hover hover:text-ink"
        >
          <Plus size={13} />
          Set a price
        </button>
      )}
    </div>
  );
};
