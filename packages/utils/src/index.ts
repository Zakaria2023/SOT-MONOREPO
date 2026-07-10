import type { SelectOffers } from "services";

/** Formats a numeric amount as whole-unit currency, e.g. "SAR 17,768". */
export const formatMoney = (amount: number, currency: string | null): string =>
  `${currency ?? "SAR"} ${Math.round(amount).toLocaleString("en-US")}`;

/** Sum of an offer's product, install, and (optional) programming prices. */
export const offerTotal = (offer: SelectOffers): number =>
  Number(offer.productPrice) +
  Number(offer.installPrice) +
  Number(offer.programmingPrice ?? 0);
