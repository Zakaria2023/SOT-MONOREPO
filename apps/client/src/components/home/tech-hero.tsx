"use client";

import {
  ArrowRight,
  Layers,
  Server,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

const SotScene = dynamic(
  () => import("@/components/home/sot-scene").then((mod) => mod.SotScene),
  { ssr: false },
);

const TRUST = [
  { icon: Wrench, label: "Installed by SOT Solutions" },
  { icon: ShieldCheck, label: "2-year warranty" },
  { icon: Server, label: "On-site installation" },
];

export const TechHero = () => (
  <section className="relative bg-page">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute -top-40 -right-24 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(124,110,255,0.22),transparent_70%)]" />
      <div className="absolute -top-32 -left-24 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.13),transparent_70%)]" />
      <div className="absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
    </div>

    <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
          <span className="font-mono text-[11.5px] tracking-[0.06em] text-accent-cyan uppercase">
            Enterprise Network Deployment
          </span>
        </span>

        <h1 className="font-display mt-6 text-[clamp(38px,5vw,58px)] leading-[1.03] font-bold tracking-[-0.03em]">
          <span className="block text-ink">Your enterprise network,</span>
          <span className="text-accent-gradient block">
            quoted and ready to build.
          </span>
        </h1>

        <p className="font-grotesk mt-6 max-w-[30rem] text-[17px] leading-relaxed text-muted">
          Gateway, switching, WiFi 6 and surveillance — configured, delivered
          and installed by SOT Solutions. Review it, accept it, track it.
        </p>

        <div className="mt-8 flex flex-wrap gap-3.5">
          <Link
            href="/products"
            className="group bg-accent-gradient font-grotesk inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-[#07101F] shadow-[0_16px_40px_-14px_rgba(34,211,238,0.7)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-14px_rgba(139,123,255,0.75)]"
          >
            Browse products
            <ArrowRight
              size={17}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
          <Link
            href="/categories"
            className="font-grotesk inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-search-border hover:bg-hover"
          >
            <Layers size={17} className="text-accent-cyan" />
            Shop by solution
          </Link>
          <Link
            href="/ai"
            className="font-grotesk inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-search-border hover:bg-hover"
          >
            <Sparkles size={17} className="text-accent-violet" />
            Ask AI
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3">
          {TRUST.map((item) => (
            <span
              key={item.label}
              className="font-grotesk inline-flex items-center gap-2 text-[13px] text-muted"
            >
              <item.icon size={16} className="text-accent-cyan" />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative h-[440px]">
        <div
          aria-hidden="true"
          className="animate-orb-pulse absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(124,110,255,0.4),transparent_70%)] blur-2xl"
        />
        <SotScene />
      </div>
    </div>
  </section>
);
