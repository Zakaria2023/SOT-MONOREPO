"use client";

import { checkout, removeItem, updateQuantity } from "@/app/cart/actions";
import { documentDownloadUrl } from "@/lib/documents";
import { formatMoney, lineTotal, summarizeCart } from "utils";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Minus,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { CartLineItem } from "services";

type CartViewProps = {
  items: CartLineItem[];
};

export const CartView = ({ items: initialItems }: CartViewProps) => {
  const [items, setItems] = useState(initialItems);
  const [, startTransition] = useTransition();

  const changeQuantity = (uuid: string, nextQuantity: number) => {
    if (nextQuantity < 1) return;
    setItems((prev) =>
      prev.map((item) =>
        item.uuid === uuid ? { ...item, quantity: nextQuantity } : item,
      ),
    );
    startTransition(() => {
      void updateQuantity(uuid, nextQuantity);
    });
  };

  const remove = (uuid: string) => {
    setItems((prev) => prev.filter((item) => item.uuid !== uuid));
    startTransition(() => {
      void removeItem(uuid);
    });
  };

  const currency = items[0]?.currency ?? "SAR";
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const { subtotal, vat, total } = summarizeCart(items);

  return (
    <main className="w-full bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8">
        <Link
          href="/"
          className="font-grotesk inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} />
          Continue shopping
        </Link>

        <h1 className="font-heading mt-4 text-4xl text-ink">Your cart</h1>
        <p className="font-grotesk mt-1 text-sm text-faint">
          {itemCount} {itemCount === 1 ? "item" : "items"} in your basket
        </p>

        <div className="mt-8 grid gap-7 lg:grid-cols-[1.6fr_380px]">
          <div className="rounded-[18px] border border-hairline bg-surface shadow-[0_18px_40px_-24px_rgba(20,22,27,0.12)]">
            {items.length === 0 ? (
              <p className="font-grotesk p-10 text-center text-faint">
                Your cart is empty.
              </p>
            ) : (
              items.map((item, index) => (
                <div
                  key={item.uuid}
                  className={cn(
                    "flex items-center gap-4 p-5",
                    index > 0 && "border-t border-hairline",
                  )}
                >
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-primary-tint">
                    {item.image ? (
                      <Image
                        src={documentDownloadUrl(item.image)}
                        alt={item.name}
                        fill
                        unoptimized
                        className="object-contain p-2"
                      />
                    ) : (
                      <Package size={26} className="text-primary" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {item.categoryName && (
                      <p className="font-grotesk text-xs text-faint">
                        {item.categoryName}
                      </p>
                    )}
                    <p className="font-heading text-base font-bold text-ink">
                      {item.name}
                    </p>
                    <p className="font-grotesk text-xs text-faint">
                      {formatMoney(Number(item.unitPrice), currency)} each
                    </p>
                  </div>

                  <div className="flex items-center rounded-full border border-search-border">
                    <button
                      type="button"
                      onClick={() =>
                        changeQuantity(item.uuid, item.quantity - 1)
                      }
                      disabled={item.quantity <= 1}
                      aria-label="Decrease quantity"
                      className="flex h-9 w-9 items-center justify-center rounded-l-full text-muted transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="font-grotesk w-8 text-center text-sm font-medium tabular-nums text-ink">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        changeQuantity(item.uuid, item.quantity + 1)
                      }
                      aria-label="Increase quantity"
                      className="flex h-9 w-9 items-center justify-center rounded-r-full text-muted transition-colors hover:text-primary"
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  <span className="font-grotesk w-24 text-right text-base font-bold tabular-nums text-ink">
                    {formatMoney(
                      lineTotal(item.unitPrice, item.quantity),
                      currency,
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() => remove(item.uuid)}
                    aria-label={`Remove ${item.name}`}
                    className="text-faint transition-colors hover:text-red-500"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="h-fit rounded-[18px] border border-hairline bg-surface p-6 shadow-[0_18px_40px_-24px_rgba(20,22,27,0.12)] lg:sticky lg:top-24">
            <h2 className="font-heading text-xl text-ink">Order summary</h2>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-grotesk text-muted">Subtotal</span>
                <span className="font-grotesk font-medium tabular-nums text-ink">
                  {formatMoney(subtotal, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-grotesk text-muted">VAT (15%)</span>
                <span className="font-grotesk font-medium tabular-nums text-ink">
                  {formatMoney(vat, currency)}
                </span>
              </div>
            </div>

            <div className="my-5 border-t border-hairline" />

            <div className="flex items-center justify-between">
              <span className="font-grotesk text-base font-medium text-ink">
                Total
              </span>
              <span className="font-heading text-3xl tabular-nums text-ink">
                {formatMoney(total, currency)}
              </span>
            </div>

            <form action={checkout} className="mt-6">
              <button
                type="submit"
                disabled={items.length === 0}
                className="font-grotesk inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.6)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
              >
                Checkout
                <ArrowRight size={18} />
              </button>
            </form>

            <Link
              href="/"
              className="font-grotesk mt-3 inline-flex w-full items-center justify-center rounded-xl border border-search-border py-3.5 text-base font-semibold text-ink transition-colors hover:bg-surface-2"
            >
              Continue shopping
            </Link>

            <p className="font-grotesk mt-4 text-center text-xs text-faint">
              Installation &amp; configuration by SOT included. Prices in SAR.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};
