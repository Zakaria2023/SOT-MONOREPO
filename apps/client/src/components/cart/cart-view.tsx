"use client";

import {
  checkout,
  checkoutProducts,
  removeItem,
  updateQuantity,
} from "@/app/cart/actions";
import { useCompatibility } from "@/app/cart/use-compatibility";
import { CompatibilityGateModal } from "@/components/cart/compatibility-gate-modal";
import { DesignCheck } from "@/components/cart/design-check";
import { ProjectQuestions } from "@/components/cart/project-questions";
import { ProfileGateModal } from "@/components/profile/profile-gate-modal";
import { documentImageUrl } from "@/lib/documents";
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
import { SupplyNote } from "@/components/shared/supply-note";
import {
  applyPercentDiscount,
  formatMoney,
  fromMinorUnits,
  lineTotal,
  summarizeCart,
  toMinorUnits,
} from "utils";
import type { ProjectAnswersInput } from "validators";

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
  // Applied once here, to the subtotal. Never to a line — see the note where
  // the product rows are built.
  discountPercent: number;
  footer: ReactNode;
  onQuantity: (uuid: string, quantity: number) => void;
  onRemove: (uuid: string) => void;
};

const CartRow = ({ item, currency, onQuantity, onRemove }: CartRowProps) => (
  <div className="flex items-center gap-4 py-5">
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-primary-tint">
      {item.image ? (
        <Image
          src={documentImageUrl(item.image)}
          alt={item.name}
          fill
          sizes="64px"
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
      {/* P11. Named on the line rather than only at checkout. A product can go
          out of stock while it sits here, and the order will be refused for it —
          so the basket has to say WHICH line, or the refusal sends somebody
          hunting through their own cart for a fault we already know the name of.
          `available` with nothing to say renders nothing. */}
      <SupplyNote supply={item.supply} />
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
  discountPercent,
  footer,
  onQuantity,
  onRemove,
}: CartSectionProps) => {
  // A line with no price is NOT a line worth zero. summarizeCart would read it
  // as 0.00 and quietly shrink the bill, so it is pulled out and named instead —
  // and checkout refuses it server-side for the same reason.
  const unpriced = items.filter(
    (item) => item.unitPrice === null || item.unitPrice === "",
  );
  const priced = items.filter(
    (item) => item.unitPrice !== null && item.unitPrice !== "",
  );

  // P11. The lines checkout will refuse, worked out from the same classifier the
  // server gate uses — so the warning here and the refusal there cannot disagree
  // about which line is the problem.
  const unsellable = items.filter(
    (item) => item.supply.state === "unavailable",
  );

  const { subtotal } = summarizeCart(priced);
  const discountAmount =
    discountPercent > 0
      ? fromMinorUnits(
          toMinorUnits(subtotal) -
            toMinorUnits(applyPercentDiscount(subtotal, discountPercent)),
        )
      : 0;
  const net = subtotal - discountAmount;
  const { vat, total } = summarizeCart([{ unitPrice: net, quantity: 1 }]);

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
          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-muted">
              <span>Partner discount ({discountPercent}%)</span>
              <span className="tabular-nums text-emerald-600">
                −{formatMoney(discountAmount, currency)}
              </span>
            </div>
          )}
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
          {unpriced.length > 0 && (
            <p className="pt-1 text-xs text-amber-700">
              {unpriced.length === 1 ? "One item is" : `${unpriced.length} items are`}{" "}
              not priced yet and {unpriced.length === 1 ? "is" : "are"} not in this
              total. We will quote{" "}
              {unpriced.map((item) => item.name).join(", ")}.
            </p>
          )}
          {/* Said here as well as on the line, because this is where somebody is
              standing when they press the button that is about to be refused.
              Warned rather than disabled: the fix is to remove the line, and a
              dead button does not tell them that. */}
          {unsellable.length > 0 && (
            <p className="pt-1 text-xs text-red-600">
              Remove {unsellable.map((item) => item.name).join(", ")} to
              continue — {unsellable.length === 1 ? "it cannot" : "they cannot"}{" "}
              be supplied at the moment.
            </p>
          )}
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
      className="font-grotesk inline-flex items-center justify-center gap-2 rounded-xl bg-primary-solid px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.5)] transition-all hover:-translate-y-0.5 hover:bg-primary-solid-hover disabled:pointer-events-none disabled:opacity-70"
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
      {pending ? (
        <Loader2 size={17} className="animate-spin" />
      ) : (
        <CreditCard size={17} />
      )}
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

  // Answers to the project questions the check asks for. Held here rather than in
  // the questions panel because both checkout forms have to submit them: the gate
  // runs again on the server, and it must judge the design the buyer was shown.
  const [answers, setAnswers] = useState<ProjectAnswersInput>({});

  // Design check over everything in the cart, re-run (debounced) on change.
  // Blockers (missing companions + broken rules) must be fixed; warnings caution.
  const { blockers, warnings, unknowns, partial, questions } = useCompatibility(
    items,
    answers,
  );
  // The form intercepted before checkout; "Continue anyway" (warnings only)
  // re-submits it with the gate bypassed.
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
  // Lines stay at MSRP even for a partner. A discounted UNIT price is the
  // partner's buy-in price, and putting it on screen publishes the margin —
  // which is why the discount is presented once, as a lump sum, in the summary
  // below. A leaked cart total reveals no per-item price; a leaked line does.
  const displayProducts = products;

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
      <div className="px-6 py-12 lg:px-12 xl:px-20">
        {/* Back to the catalogue, not to the home page: shopping continues
            where the products are. */}
        <Link
          href="/products"
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
            <DesignCheck
              blockers={blockers}
              warnings={warnings}
              unknowns={unknowns}
              partial={partial}
            />

            {/* Below the findings, because the questions only make sense once the
                buyer has read what they would clear. */}
            <ProjectQuestions
              questions={questions}
              answers={answers}
              onChange={setAnswers}
            />

            {[...solutionGroups.entries()].map(([categoryUuid, groupItems]) => (
              <CartSection
                discountPercent={discountPercent}
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
                      // Blocking issues can't be bypassed; warnings can, after
                      // one more look. Both open the design-check gate.
                      if (
                        blockers.length > 0 ||
                        (warnings.length > 0 &&
                          !bypassCompatibilityGate.current)
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
                    <input
                      type="hidden"
                      name="projectInputs"
                      value={JSON.stringify(answers)}
                    />
                    <BoqSubmitButton />
                  </form>
                }
              />
            ))}

            {products.length > 0 && (
              <CartSection
                discountPercent={discountPercent}
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
                        return;
                      }
                      // A broken design blocks the direct order too.
                      if (blockers.length > 0) {
                        event.preventDefault();
                        setPendingCheckout(event.currentTarget);
                      }
                    }}
                  >
                    <input
                      type="hidden"
                      name="projectInputs"
                      value={JSON.stringify(answers)}
                    />
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
          blockers={blockers}
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
