import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "outline" | "ghost" | "icon" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover",
  outline:
    "gap-1.5 rounded-control border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-hover",
  ghost:
    "gap-1.5 rounded-control px-4 py-2 text-sm font-semibold text-secondary hover:bg-hover",
  icon: "h-10 w-10 rounded-control border border-hairline text-secondary hover:bg-hover",
  danger:
    "gap-1.5 rounded-control bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90",
};

export const Button = ({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) => (
  <button
    className={`flex cursor-pointer items-center disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`}
    {...props}
  >
    {children}
  </button>
);
