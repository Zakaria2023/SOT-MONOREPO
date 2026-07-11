"use client";

import { Clock, CreditCard } from "lucide-react";
import { useState } from "react";

// Immediate product checkout. Payment isn't wired yet, so it surfaces a
// "coming soon" state rather than creating an order.
export const BuyNowButton = () => {
  const [soon, setSoon] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setSoon(true)}
      aria-label="Buy now"
      className="bg-accent-gradient font-grotesk inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-bold text-[#07101F] transition-opacity hover:opacity-90"
    >
      {soon ? <Clock size={16} /> : <CreditCard size={16} />}
      {soon ? "Coming soon" : "Buy now"}
    </button>
  );
};
