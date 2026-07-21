import { cn } from "@/lib/utils";
import { applyPercentDiscount, formatMoney, formatPrice } from "utils";

type ProductPriceProps = {
  price: string | null;
  currency: string | null;
  // The viewer's partner discount (0 = show MSRP as-is).
  discountPercent: number;
  className?: string;
  originalClassName?: string;
};

// Renders the price a viewer pays. For partners with a discount it shows the
// discounted price with the MSRP struck through and a "-N%" badge; otherwise
// just the public price.
export const ProductPrice = ({
  price,
  currency,
  discountPercent,
  className,
  originalClassName,
}: ProductPriceProps) => {
  if (!price || discountPercent <= 0) {
    return (
      <span className={cn("tabular-nums", className)}>
        {formatPrice(price, currency)}
      </span>
    );
  }

  const discounted = applyPercentDiscount(price, discountPercent);

  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={cn("tabular-nums", className)}>
        {formatMoney(discounted, currency)}
      </span>
      <span
        className={cn(
          "text-sm font-medium text-faint line-through",
          originalClassName,
        )}
      >
        {formatPrice(price, currency)}
      </span>
      <span className="rounded-full bg-primary-tint px-2 py-0.5 text-[11px] font-bold text-primary">
        -{discountPercent}%
      </span>
    </span>
  );
};
