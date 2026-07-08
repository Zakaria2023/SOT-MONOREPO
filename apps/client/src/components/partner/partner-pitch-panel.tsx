import { Menu, Shield, Sparkles, Zap } from "lucide-react";
import type { ComponentType } from "react";

type IconType = ComponentType<{ size?: number; className?: string }>;

type Perk = {
  icon: IconType;
  label: string;
};

const perks: Perk[] = [
  { icon: Zap, label: "Get matched to live deployments near you" },
  { icon: Sparkles, label: "Quote directly from the Stratum catalog" },
  { icon: Shield, label: "Listed by what you do best — clients find you" },
];

export const PartnerPitchPanel = () => (
  <div className="relative hidden flex-col justify-between overflow-hidden bg-[#08080C] p-10 min-[940px]:flex">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.45),transparent_60%)]"
    />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-size-[26px_26px] mask-[radial-gradient(ellipse_at_center,black_40%,transparent_82%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_82%)]"
    />
    <div
      aria-hidden="true"
      className="animate-orb-pulse pointer-events-none absolute -left-10 top-16 h-72 w-72 rounded-full bg-primary/30 blur-3xl"
    />

    <div className="relative z-10 flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary text-white">
        <Menu size={18} strokeWidth={2.5} />
      </span>
      <span className="font-heading text-xl text-white">Stratum</span>
    </div>

    <div className="relative z-10 max-w-sm">
      <p className="font-grotesk text-xs font-semibold uppercase tracking-widest text-[#C4B5FD]">
        Partner program
      </p>
      <h1 className="font-heading mt-4 bg-linear-to-br from-white to-[#8F8C9E] bg-clip-text text-4xl leading-tight text-transparent">
        Grow with the network everyone’s building on.
      </h1>
      <p className="font-grotesk mt-4 max-w-[340px] text-base leading-relaxed text-[#A29FAF]">
        Join Stratum’s installer &amp; integrator network. Get matched to live
        deployments, quote from our catalog, and let clients find you by what
        you do best.
      </p>

      <ul className="mt-8 flex flex-col gap-4">
        {perks.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-primary/10 text-[#C4B5FD]">
              <Icon size={18} />
            </span>
            <span className="font-grotesk text-sm text-[#CFCCD8]">{label}</span>
          </li>
        ))}
      </ul>
    </div>

    <div className="relative z-10 flex items-center gap-2 text-[#86838F]">
      <Shield size={15} className="text-primary" />
      <span className="font-grotesk text-xs">
        Reviewed by SOT Solutions · usually within 3 business days
      </span>
    </div>
  </div>
);
