import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
};

export const AuthShell = ({ children }: AuthShellProps) => (
  <main className="relative flex min-h-[calc(100dvh-4.5rem)] w-full items-center justify-center overflow-hidden bg-linear-to-b from-[#EDEAF6] to-[#F3F4F8] px-6 py-16 dark:from-[#060a14] dark:to-[#0a1020]">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(20,22,27,0.06)_1px,transparent_1px)] bg-size-[26px_26px] mask-[radial-gradient(ellipse_at_center,black_45%,transparent_85%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_85%)] dark:bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)]"
    />
    {children}
  </main>
);
