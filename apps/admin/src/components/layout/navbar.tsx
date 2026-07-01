import { Bell, Plus } from "lucide-react";
import type { ChangeEventHandler } from "react";
import { Input } from "@/components/ui/input";

type NavbarProps = {
  title: string;
  subtitle?: string;
  search: string;
  onSearchChange: ChangeEventHandler<HTMLInputElement>;
  searchPlaceholder?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const Navbar = ({
  title,
  subtitle,
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  actionLabel,
  onAction,
}: NavbarProps) => (
  <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-hairline bg-surface/80 px-7.5 py-4 backdrop-blur">
    <div className="flex flex-col">
      <h1 className="font-heading text-2xl font-extrabold text-ink">
        {title}
      </h1>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
    </div>

    <div className="flex items-center gap-3">
      <Input
        value={search}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
      />

      <button
        type="button"
        className="relative flex h-10 w-10 items-center justify-center rounded-control border border-hairline text-secondary hover:bg-hover"
      >
        <Bell size={18} />
        <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-danger" />
      </button>

      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          {actionLabel}
        </button>
      )}
    </div>
  </header>
);
