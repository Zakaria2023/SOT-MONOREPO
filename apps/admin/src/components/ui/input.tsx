import { Search } from "lucide-react";
import type { ChangeEventHandler } from "react";

type InputProps = {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
};

export const Input = ({ value, onChange, placeholder }: InputProps) => (
  <div className="relative w-60">
    <Search
      size={16}
      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
    />
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-control border border-search-border bg-surface py-2 pr-3 pl-9 text-sm text-ink outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(124,58,237,0.13)]"
    />
  </div>
);
