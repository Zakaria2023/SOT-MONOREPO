"use client";

import {
  checkout,
  checkoutProducts,
  removeItem,
  updateQuantity,
} from "@/app/cart/actions";
import { useCompatibility } from "@/app/cart/use-compatibility";
import { CompatibilityGateModal } from "@/components/cart/compatibility-gate-modal";
import { CompatibilityWarnings } from "@/components/cart/compatibility-warnings";
import { ProfileGateModal } from "@/components/profile/profile-gate-modal";
import { documentDownloadUrl } from "@/lib/documents";
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Loader2,
  Minus,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { CartLineItem } from "services";
import { applyPercentDiscount, formatMoney, lineTotal, summarizeCart } from "utils";

type CartViewProps = {
  items: CartLineItem[];
  needsProfile: boolean;
  discountPercent?: number;
};

type CartRowProps = {
  item: CartLineItem;
  currency: string;
  onQuantity: (uuid: string, quantity: number) => void;
  onRemove: (uuid: string) => void;
};

type CartSectionProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  items: CartLineItem[];
  currency: string;
  footer: ReactNode;
  onQuantity: (uuid: string, quantity: number) => void;
  onRemove: (uuid: string) => void;
};

const CartRow = ({ item, currency, onQuantity, onRemove }: CartRowProps) => (
  <div className="flex items-center gap-4 py-5">
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
        <p className="font-grotesk text-xs text-faint">{item.categoryName}</p>
      )}
      <p className="font-heading text-base font-bold text-ink">{item.name}</p>
      <p className="font-grotesk text-xs text-faint">
        {formatMoney(Number(item.unitPrice), currency)} each
      </p>
    </div>

    <div className="flex items-center rounded-full border border-search-border">
      <button
        type="button"
        onClick={() => onQuantity(item.uuid, item.quantity - 1)}
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
        onClick={() => onQuantity(item.uuid, item.quantity + 1)}
        aria-label="Increase quantity"
        className="flex h-9 w-9 items-center justify-center rounded-r-full text-muted transition-colors hover:text-primary"
      >
        <Plus size={15} />
      </button>
    </div>

    <span className="font-grotesk w-24 text-right text-base font-bold tabular-nums text-ink">
      {formatMoney(lineTotal(item.unitPrice, item.quantity), currency)}
    </span>

    <button
      type="button"
      onClick={() => onRemove(item.uuid)}
      aria-label={`Remove ${item.name}`}
      className="text-faint transition-colors hover:text-red-500"
    >
      <Trash2 size={18} />
    </button>
  </div>
);

const CartSection = ({
  eyebrow,
  title,
  subtitle,
  items,
  currency,
  footer,
  onQuantity,
  onRemove,
}: CartSectionProps) => {
  const { subtotal, vat, total } = summarizeCart(items);

  return (
    <section className="rounded-[18px] border border-hairline bg-surface p-6 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {eyebrow && (
            <p className="font-grotesk text-xs font-semibold uppercase tracking-wide text-primary">
              {eyebrow}
            </p>
          )}
          <h2 className="font-heading text-xl text-ink">{title}</h2>
          <p className="font-grotesk mt-0.5 text-sm text-faint">{subtitle}</p>
        </div>
        <span className="font-grotesk rounded-full bg-primary-tint px-3 py-1 text-xs font-semibold text-primary">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="mt-4 divide-y divide-hairline border-y border-hairline">
        {items.map((item) => (
          <CartRow
            key={item.uuid}
            item={item}
            currency={currency}
            onQuantity={onQuantity}
            onRemove={onRemove}
          />
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
        {footer}
      </div>
    </section>
  );
};

// Submit button for the "Send as BOQ" form. useFormStatus reports the server
// action's pending state, so the button shows a spinner and stays disabled from
// click until the redirect lands — the user never sees a dead moment.
const BoqSubmitButton = () => {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="font-grotesk inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.5)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-70"
    >
      {pending ? (
        <>
          <Loader2 size={17} className="animate-spin" />
          Sending…
        </>
      ) : (
        <>
          Send as BOQ
          <ArrowRight size={17} />
        </>
      )}
    </button>
  );
};

const ProductCheckoutButton = () => {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-accent-gradient font-grotesk inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-[#07101F] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-70"
    >
      {pending ? <Loader2 size={17} className="animate-spin" /> : <CreditCard size={17} />}
      {pending ? "Placing order…" : "Checkout & pay"}
    </button>
  );
};

export const CartView = ({
  items: initialItems,
  needsProfile,
  discountPercent = 0,
}: CartViewProps) => {
  const [items, setItems] = useState(initialItems);
  const [showProfileGate, setShowProfileGate] = useState(false);
  const [, startTransition] = useTransition();

  // Advisory compatibility check over everything in the cart, re-run
  // (debounced) whenever lines or quantities change.
  const warnings = useCompatibility(items);
  // The BOQ form intercepted before checkout; "Continue anyway" re-submits it
  // with the gate bypassed.
  const [pendingCheckout, setPendingCheckout] =
    useState<HTMLFormElement | null>(null);
  const bypassCompatibilityGate = useRef(false);

  const onQuantity = (uuid: string, nextQuantity: number) => {
    if (nextQuantity < 1) {
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.uuid === uuid ? { ...item, quantity: nextQuantity } : item,
      ),
    );
    startTransition(() => {
      void updateQuantity(uuid, nextQuantity);
    });
  };

  const onRemove = (uuid: string) => {
    setItems((prev) => prev.filter((item) => item.uuid !== uuid));
    startTransition(() => {
      void removeItem(uuid);
    });
  };

  const currency = items[0]?.currency ?? "SAR";
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const products = items.filter((item) => item.kind === "product");
  // Partners pay the discounted price — reflect it in the product lines/totals.
  const displayProducts =
    discountPercent > 0
      ? products.map((item) => ({
          ...item,
          unitPrice: applyPercentDiscount(
            item.unitPrice,
            discountPercent,
          ).toFixed(2),
        }))
      : products;

  // Each solution (a whole category added at once) gets its own checkout card,
  // keyed by the category its products belong to.
  const solutionGroups = new Map<string, CartLineItem[]>();
  for (const item of items) {
    if (item.kind !== "solution" || !item.categoryUuid) {
      continue;
    }
    const group = solutionGroups.get(item.categoryUuid) ?? [];
    group.push(item);
    solutionGroups.set(item.categoryUuid, group);
  }

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

        {items.length === 0 ? (
          <p className="font-grotesk mt-8 rounded-[18px] border border-hairline bg-surface p-10 text-center text-faint">
            Your cart is empty.
          </p>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            <CompatibilityWarnings warnings={warnings} />

            {[...solutionGroups.entries()].map(([categoryUuid, groupItems]) => (
              <CartSection
                key={categoryUuid}
                eyebrow="Solution"
                title={groupItems[0]?.categoryName ?? "Solution"}
                subtitle="Sent as a BOQ — our team reviews it and returns a quote."
                items={groupItems}
                currency={currency}
                onQuantity={onQuantity}
                onRemove={onRemove}
                footer={
                  <form
                    action={checkout}
                    onSubmit={(event) => {
                      if (needsProfile) {
                        event.preventDefault();
                        setShowProfileGate(true);
                        return;
                      }
                      // Final look at the rule warnings before the order goes
                      // out — agreed flow: warn again at checkout, never block.
                      if (
                        warnings.length > 0 &&
                        !bypassCompatibilityGate.current
                      ) {
                        event.preventDefault();
                        setPendingCheckout(event.currentTarget);
                      }
                    }}
                  >
                    <input
                      type="hidden"
                      name="categoryUuid"
                      value={categoryUuid}
                    />
                    <BoqSubmitButton />
                  </form>
                }
              />
            ))}

            {products.length > 0 && (
              <CartSection
                title="Products"
                subtitle={
                  discountPercent > 0
                    ? `Buy individually — partner pricing (${discountPercent}% off) applied.`
                    : "Buy individually — checkout and pay right away."
                }
                items={displayProducts}
                currency={currency}
                onQuantity={onQuantity}
                onRemove={onRemove}
                footer={
                  <form
                    action={checkoutProducts}
                    onSubmit={(event) => {
                      if (needsProfile) {
                        event.preventDefault();
                        setShowProfileGate(true);
                      }
                    }}
                  >
                    <ProductCheckoutButton />
                  </form>
                }
              />
            )}
          </div>
        )}
      </div>

      {showProfileGate && (
        <ProfileGateModal
          next="/cart"
          onClose={() => setShowProfileGate(false)}
        />
      )}

      {pendingCheckout && (
        <CompatibilityGateModal
          warnings={warnings}
          onContinue={() => {
            bypassCompatibilityGate.current = true;
            pendingCheckout.requestSubmit();
            bypassCompatibilityGate.current = false;
            setPendingCheckout(null);
          }}
          onClose={() => setPendingCheckout(null)}
        />
      )}
    </main>
  );
};
