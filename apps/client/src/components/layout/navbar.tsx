import { getCachedCategories } from "@/lib/data";
import { Menu } from "lucide-react";
import Link from "next/link";

export const Navbar = async () => {
  const categories = await getCachedCategories();
  const topLevel = categories.filter((category) => category.parentUuid === null);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#ECEEF1] bg-white shadow-[0_1px_3px_rgba(20,22,27,0.06)]">
      <nav className="mx-auto flex h-18 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
            <Menu size={20} strokeWidth={2.5} />
          </span>
          <span className="font-heading text-2xl font-extrabold text-ink">
            Stratum
          </span>
        </Link>

        <div className="hidden items-center gap-9 md:flex">
          {topLevel.map((category) => (
            <Link
              key={category.uuid}
              href={`/categories/${category.uuid}`}
              className="font-grotesk text-sm font-medium text-[#3C3F46] transition-colors hover:text-primary"
            >
              {category.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="font-grotesk rounded-[10px] border border-[#E3E4E9] px-4 py-2.5 text-sm font-medium text-[#3C3F46] transition-colors hover:bg-[#F5F3FB] hover:text-primary"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="font-grotesk rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-6px_rgba(124,58,237,0.5)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
          >
            Sign up
          </Link>
        </div>
      </nav>
    </header>
  );
};
