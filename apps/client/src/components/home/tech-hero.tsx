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
import { useSyncExternalStore } from "react";

const SotScene = dynamic(
  () => import("@/components/home/sot-scene").then((mod) => mod.SotScene),
  { ssr: false },
);

// Matches the `lg` breakpoint below, where the hero becomes two columns and the
// scene gets a column of its own.
const SCENE_QUERY = "(min-width: 1024px)";

const subscribe = (onChange: () => void) => {
  const list = window.matchMedia(SCENE_QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
};

const isWideViewport = () => window.matchMedia(SCENE_QUERY).matches;

// False on the server, so the markup it renders matches the first client render.
// Safe because the scene is decoration: nothing depends on it being in the first
// paint.
const isWideOnServer = () => false;

const TRUST = [
  { icon: Wrench, label: "Installed by SOT Solutions" },
  { icon: ShieldCheck, label: "2-year warranty" },
  { icon: Server, label: "On-site installation" },
];

export const TechHero = () => {
  /**
   * Whether to mount the WebGL scene at all.
   *
   * `hidden lg:block` took it off the screen but not off the wire: the component
   * still mounted, so three.js plus TextGeometry and FontLoader were still
   * downloaded, parsed and executed on a phone that never showed a pixel of it.
   * That is most of the ~800ms of total blocking time, spent on decoration the
   * device was not going to display.
   *
   * useSyncExternalStore rather than useState in an effect. A media query IS an
   * external store, and reading one into state means a synchronous setState in an
   * effect body — a cascading render, caught by the same lint rule that caught
   * the mobile drawer earlier today. This keeps tracking changes too, so rotating
   * a tablet into landscape brings the scene in.
   */
  const showScene = useSyncExternalStore(
    subscribe,
    isWideViewport,
    isWideOnServer,
  );

  return (
    <section className="relative bg-page">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 -right-24 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(124,110,255,0.22),transparent_70%)]" />
        <div className="absolute -top-32 -left-24 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.13),transparent_70%)]" />
        <div className="absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      </div>

      {/* `min-w-0` on both cells: a grid child defaults to min-width:auto, so the
        canvas could otherwise claim more than its track and squeeze the copy.
        The lg two-column split itself is left alone — it measures fine at
        1024. */}
      <div className="relative mx-auto grid items-center gap-10 px-6 py-14 sm:gap-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-12 xl:px-20">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(38px,5vw,58px)] leading-[1.03] font-bold tracking-[-0.03em]">
            <span className="block text-ink">Your enterprise network,</span>
            <span className="text-accent-gradient block">
              quoted and ready to build.
            </span>
          </h1>

          <p className="font-grotesk mt-6 max-w-120 text-base leading-relaxed text-muted sm:text-[17px]">
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
            <button
              type="button"
              className="font-grotesk inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-search-border hover:bg-hover"
            >
              <Sparkles size={17} className="text-accent-violet" />
              Ask AI
            </button>
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

        {/* Still `hidden lg:block` so the layout is right before hydration decides,
          but the scene inside is only mounted once the viewport is actually wide
          enough — otherwise three.js ships to a device that never renders it. */}
        <div className="relative hidden min-w-0 lg:block lg:h-110">
          <div
            aria-hidden="true"
            className="animate-orb-pulse absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(124,110,255,0.4),transparent_70%)] blur-2xl"
          />
          {showScene && <SotScene />}
        </div>
      </div>
    </section>
  );
};
