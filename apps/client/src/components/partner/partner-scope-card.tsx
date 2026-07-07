import { cn } from "@/lib/utils";
import type { ComponentType } from "react";
import type { PartnerRequestInput } from "validators";

type IconType = ComponentType<{ size?: number; className?: string }>;

type PartnerScopeCardProps = {
  value: PartnerRequestInput["serviceScope"];
  selected: boolean;
  onSelect: (value: PartnerRequestInput["serviceScope"]) => void;
  icon: IconType;
  title: string;
  description: string;
};

export const PartnerScopeCard = ({
  value,
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
}: PartnerScopeCardProps) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={() => onSelect(value)}
    className={cn(
      "flex flex-col rounded-[14px] border p-4 text-left transition-all",
      selected
        ? "border-primary bg-primary/5 ring-4 ring-primary/15"
        : "border-[#E3E4E9] hover:border-primary/40",
    )}
  >
    <div className="flex items-start justify-between">
      <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary/10 text-primary">
        <Icon size={18} />
      </span>
      <span
        className={cn(
          "mt-1 flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-primary" : "border-[#D5D6DD]",
        )}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full bg-primary transition-opacity",
            selected ? "opacity-100" : "opacity-0",
          )}
        />
      </span>
    </div>
    <h3 className="font-heading mt-3 text-base text-ink">{title}</h3>
    <p className="font-grotesk mt-1 text-xs leading-relaxed text-[#62656B]">
      {description}
    </p>
  </button>
);
