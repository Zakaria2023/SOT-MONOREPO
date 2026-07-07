export const formatMoney = (amount: number, currency: string | null): string =>
  `${currency ?? "SAR"} ${Math.round(amount).toLocaleString("en-US")}`;
