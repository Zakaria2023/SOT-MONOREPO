import {
  Boxes,
  Cable,
  Cpu,
  Layers,
  Router,
  Shield,
  ShieldCheck,
  Shuffle,
  Wifi,
  type LucideIcon,
} from "lucide-react";

const ICON_BY_KEYWORD: { match: string; icon: LucideIcon }[] = [
  { match: "wifi", icon: Wifi },
  { match: "access point", icon: Wifi },
  { match: "switch", icon: Shuffle },
  { match: "security", icon: Shield },
  { match: "automation", icon: ShieldCheck },
  { match: "passive", icon: Layers },
  { match: "cabl", icon: Cable },
  { match: "server", icon: Cpu },
  { match: "network", icon: Router },
];

// Pick a category-type glyph from its label, else a neutral default.
export const glyphFor = (label: string | null | undefined): LucideIcon => {
  const value = (label ?? "").toLowerCase();
  const found = ICON_BY_KEYWORD.find((entry) => value.includes(entry.match));
  return found?.icon ?? Boxes;
};
