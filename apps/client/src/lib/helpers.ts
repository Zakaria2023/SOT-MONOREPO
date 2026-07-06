/** Formats a decimal price string with its currency, e.g. "SAR 4,200". */
export const formatPrice = (price: string, currency: string | null): string =>
  `${currency ?? "SAR"} ${Number(price).toLocaleString("en-US")}`;

/** Two-letter initials from a full name, e.g. "Zakaria Asad" -> "ZA". */
export const getInitials = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase() || "?";
};
