import { SelectOffers } from "services";

export const formatMoney = (amount: number, currency: string | null): string =>
  `${currency ?? "SAR"} ${Math.round(amount).toLocaleString("en-US")}`;

export const offerTotal = (offer: SelectOffers): number =>
  Number(offer.productPrice) +
  Number(offer.installPrice) +
  Number(offer.programmingPrice ?? 0);
