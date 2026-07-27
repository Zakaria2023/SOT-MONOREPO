"use client";

import { previewGuestCart } from "@/app/cart/actions";
import { useCompatibility } from "@/app/cart/use-compatibility";
import { DesignCheck } from "@/components/cart/design-check";
import { documentDownloadUrl } from "@/lib/documents";
import {
  removeFromGuestCart,
  setGuestCartQuantity,
  useGuestCart,
} from "@/lib/guest-cart";
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
import { useEffect, useMemo, useState } from "react";
import type { CartLineItem } from "services";
import { formatMoney, lineTotal, summarizeCart } from "utils";

export const GuestCartView = () => {
  const items = useGuestCart();
  const [details, setDetails] = useState<CartLineItem[]>([]);

  // Sorted product uuids — the effect re-hydrates only when the set of products
  // changes, not on a quantity tweak (quantities come from the local cart).
  const productKey = useMemo(
    () =>
      items
        .map((item) => item.productUuid)
        .sort()
        .join(","),
    [items],
  );

  useEffect(() => {
    const productUuids = productKey ? productKey.split(",") : [];
    if (productUuids.length === 0) {
      return;
    }
    let active = true;
    // Quantities are irrelevant here — we render local quantities — so pass 1.
    void previewGuestCart(
      productUuids.map((productUuid) => ({ productUuid, quantity: 1 })),
    ).then((rows) => {
      if (active) {
        setDetails(rows);
      }
    });
    return () => {
      active = false;
    };
  }, [productKey]);

  const detailByProduct = new Map(details.map((row) => [row.productUuid, row]));

  const lines: CartLineItem[] = items.flatMap((item) => {
    const detail = detailByProduct.get(item.productUuid);
    return detail ? [{ ...detail, quantity: item.quantity }] : [];
  });

  const currency = lines[0]?.currency ?? "SAR";
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const { subtotal, vat, total } = summarizeCart(lines);

  // Same design check as the signed-in cart.
  const { blockers, warnings, unknowns } = useCompatibility(lines);

  return (
    <main className="min-h-screen w-full bg-page">
      <div className="mx-auto max-w-4xl px-6 py-12 lg:px-8">
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

        {lines.length === 0 ? (
          <p className="font-grotesk mt-8 rounded-[18px] border border-hairline bg-surface p-10 text-center text-faint">
            Your cart is empty.
          </p>
        ) : (
          <>
            <div className="mt-8">
              <DesignCheck
                blockers={blockers}
                warnings={warnings}
                unknowns={unknowns}
              />
            </div>
            <section className="mt-6 rounded-[18px] border border-hairline bg-surface p-6 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)]">
              <div className="divide-y divide-hairline border-b border-hairline">
                {lines.map((item) => (
                  <div
                    key={item.productUuid}
                    className="flex items-center gap-4 py-5"
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
                          setGuestCartQuantity(
                            item.productUuid,
                            item.quantity - 1,
                          )
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
                          setGuestCartQuantity(
                            item.productUuid,
                            item.quantity + 1,
                          )
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
                      onClick={() => removeFromGuestCart(item.productUuid)}
                      aria-label={`Remove ${item.name}`}
                      className="text-faint transition-colors hover:text-red-500"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="font-grotesk w-full max-w-56 space-y-1 text-sm">
                  <div className="flex items-center justify-between text-muted">
                    <span>Subtotal</span>
                    <span className="tabular-nums text-ink">
                      {formatMoney(subtotal, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted">
                    <span>VAT (15%)</span>
                    <span className="tabular-nums text-ink">
                      {formatMoney(vat, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-base font-medium text-ink">
                    <span>Total</span>
                    <span className="font-heading text-xl tabular-nums">
                      {formatMoney(total, currency)}
                    </span>
                  </div>
                </div>

                <Link
                  href="/sign-in"
                  className="font-grotesk inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.5)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
                >
                  Sign in to checkout
                  <ArrowRight size={17} />
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
};
