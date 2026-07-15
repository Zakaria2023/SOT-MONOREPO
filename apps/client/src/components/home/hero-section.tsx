import { SplineScene } from "@/components/ui/spline-scene";
import { Spotlight } from "@/components/ui/spotlight";
import { MapPin, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

type TrustItem = {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
};

const trustItems: TrustItem[] = [
  { icon: Wrench, label: "Installed by SOT Solutions" },
  { icon: ShieldCheck, label: "2-year warranty" },
  { icon: MapPin, label: "On-site installation" },
];

export const HeroSection = () => (
  <section className="relative min-h-[600px] w-full overflow-hidden border-b border-[#1A1A22] bg-[#08080C] shadow-[0_60px_120px_-40px_rgba(0,0,0,0.65)]">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_130%_at_84%_-10%,rgba(124,58,237,0.24),transparent_50%)]"
    />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.055)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]"
    />
    <div
      aria-hidden="true"
      className="motion-safe:animate-spotlight-sweep pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(255,255,255,0.18),transparent_70%)] blur-3xl"
    />

    <div className="absolute inset-y-0 right-0 hidden w-[55%] lg:block">
      <Spotlight
        className="-top-40 left-0 md:-top-20 md:left-60"
        fill="white"
      />

      <SplineScene
        scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
        className="h-full w-full"
      />
    </div>

    <div className="pointer-events-none relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-6 py-24 lg:grid-cols-5 lg:gap-16 lg:px-8">
      <div className="pointer-events-auto lg:col-span-3">
        <h1 className="font-heading max-w-3xl bg-linear-to-b from-white to-[#ACA8BA] bg-clip-text text-5xl leading-[1.04] font-bold text-transparent md:text-6xl">
          Your enterprise network, quoted and ready to build.
        </h1>

        <p className="font-grotesk mt-6 max-w-lg text-lg leading-relaxed text-[#9A97A6]">
          Gateway, switching, WiFi 6 and surveillance — configured, delivered
          and installed by SOT Solutions. Review it, accept it, track it.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/products"
            className="font-grotesk inline-flex h-14 items-center justify-center rounded-xl bg-primary px-7 text-lg font-semibold text-white shadow-[0_8px_30px_-6px_rgba(124,58,237,0.55)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
          >
            Browse products
          </Link>

          <Link
            href="/ai"
            className="font-grotesk inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/4 px-7 text-lg font-semibold text-white transition-colors hover:border-white/20 hover:bg-white/8"
          >
            <Sparkles size={18} strokeWidth={2} className="text-violet-400" />
            Ask AI
          </Link>
        </div>

        <ul className="mt-8 flex flex-wrap items-center gap-6">
          {trustItems.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="font-grotesk flex items-center gap-2 text-sm text-[#86838F]"
            >
              <Icon size={16} className="text-violet-400" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="pointer-events-auto relative mx-auto aspect-square w-full max-w-md lg:hidden">
        <SplineScene
          scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
          className="h-full w-full"
        />
      </div>
    </div>
  </section>
);
