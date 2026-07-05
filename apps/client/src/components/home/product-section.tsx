"use client";

import {
  ArrowRight,
  Server,
  ShieldCheck,
  ShoppingCart,
  Shuffle,
  Video,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, MouseEvent } from "react";

type Product = {
  slug: string;
  brand: string;
  category: string;
  name: string;
  blurb: string;
  quantity: number;
  price?: number;
  icon: ComponentType<{ size?: number; className?: string }>;
};

const products: Product[] = [
  {
    slug: "meridian-gateway-pro-x",
    brand: "Meridian",
    category: "Security Gateway",
    name: "Meridian Gateway Pro X",
    blurb:
      "Multi-gig security gateway with on-box IDS/IPS and full traffic visibility.",
    quantity: 1,
    price: 4200,
    icon: ShieldCheck,
  },
  {
    slug: "meridian-switch-24-poe",
    brand: "Meridian",
    category: "Layer-3 Switch",
    name: "Meridian Switch 24 PoE++",
    blurb:
      "24-port managed L3 switch delivering 400W of PoE++ for APs and cameras.",
    quantity: 1,
    price: 3150,
    icon: Shuffle,
  },
  {
    slug: "meridian-ap-6-pro",
    brand: "Meridian",
    category: "WiFi 6 Access Point",
    name: "Meridian AP-6 Pro",
    blurb:
      "High-density WiFi 6 access point for demanding office environments.",
    quantity: 6,
    price: 690,
    icon: Wifi,
  },
  {
    slug: "meridian-nvr-pro",
    brand: "Meridian",
    category: "Network Video Recorder",
    name: "Meridian NVR Pro",
    blurb: "AI-accelerated NVR with 8 TB storage and smart detections.",
    quantity: 1,
    icon: Server,
  },
  {
    slug: "meridian-ai-turret-camera",
    brand: "Meridian",
    category: "4K AI Camera",
    name: "Meridian AI Turret Camera",
    blurb: "4K turret camera with on-device AI and long-range night vision.",
    quantity: 4,
    icon: Video,
  },
];

const formatQuantity = (quantity: number) =>
  quantity === 1 ? "Qty 1" : `× ${quantity}`;

const formatPrice = (price: number) => `SAR ${price.toLocaleString("en-US")}`;

export const ProductSection = () => {
  const addToCart = (event: MouseEvent, product: Product) => {
    // The Add button sits above the stretched Link, so it never triggers a
    // navigation; preventDefault guards against any bubbling regardless.
    event.preventDefault();
    // TODO: wire to the cart once the cart service exists.
    void product;
  };

  return (
    <section className="w-full bg-white pt-14 pb-24">
      <div className="mx-auto max-w-6xl px-8">
        <header className="text-center">
          <h2 className="font-heading text-3xl font-extrabold text-ink">
            Hardware in this deployment
          </h2>
          <p className="font-grotesk mt-3 text-base text-[#62656B]">
            Tap any product for full specifications.
          </p>
        </header>

        <ul className="mt-12 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
          {products.map((product) => {
            const Icon = product.icon;

            return (
              <li key={product.slug}>
                <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-within:ring-2 focus-within:ring-primary">
                  <Link
                    href={`/products/${product.slug}`}
                    aria-label={`View ${product.name} specifications`}
                    className="absolute inset-0 z-10 rounded-2xl focus:outline-none"
                  />

                  <div className="relative flex h-44 items-center justify-center bg-[#F5F3FC]">
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.18),transparent_65%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    />

                    <Icon size={40} className="relative text-primary" />

                    <span className="absolute top-3 right-3 rounded-lg bg-primary px-2.5 py-1 font-grotesk text-xs font-semibold text-white">
                      {formatQuantity(product.quantity)}
                    </span>

                    <span className="absolute bottom-3 left-3 flex h-8 w-8 translate-y-1 items-center justify-center rounded-full bg-primary text-white opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      <ArrowRight size={16} />
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2">
                      <span className="font-grotesk text-xs font-bold tracking-wide text-primary uppercase">
                        {product.brand}
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-1 w-1 rounded-full bg-[#8A8F98]"
                      />
                      <span className="font-grotesk text-xs text-[#8A8F98]">
                        {product.category}
                      </span>
                    </div>

                    <h3 className="font-heading mt-2 text-lg leading-snug font-bold text-ink">
                      {product.name}
                    </h3>

                    <p className="font-grotesk mt-2 line-clamp-2 text-sm leading-relaxed text-[#62656B]">
                      {product.blurb}
                    </p>

                    <div className="mt-4 flex items-center justify-between pt-1">
                      {product.price !== undefined ? (
                        <span className="font-grotesk text-lg font-bold tabular-nums text-ink">
                          {formatPrice(product.price)}
                        </span>
                      ) : (
                        <span />
                      )}

                      <button
                        type="button"
                        onClick={(event) => addToCart(event, product)}
                        className="font-grotesk relative z-20 inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                      >
                        <ShoppingCart size={16} />
                        Add
                      </button>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};
