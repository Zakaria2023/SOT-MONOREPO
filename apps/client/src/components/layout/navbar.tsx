import { CategoryMenu } from "@/components/layout/category-menu";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getCurrentUser } from "@/lib/auth";
import { buildCategoryTree } from "@/lib/categories";
import { getCachedCategories, getCachedProducts } from "@/lib/data";
import { Menu, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { getCartItemCount } from "services";

export const Navbar = async () => {
  const user = await getCurrentUser();
  const [categories, products, cartCount] = await Promise.all([
    getCachedCategories(),
    getCachedProducts(),
    user ? getCartItemCount(user.uuid) : Promise.resolve(0),
  ]);
  const tree = buildCategoryTree(categories, products);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-page/80 shadow-[0_1px_3px_rgba(20,22,27,0.06)] backdrop-blur-xl">
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
            <Menu size={20} strokeWidth={2.5} />
          </span>
          <span className="font-heading text-2xl text-ink">Stratum</span>
        </Link>

        <CategoryMenu categories={tree.slice(0, 3)} />

        {user ? (
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/support"
              className="font-grotesk hidden text-sm font-medium text-secondary transition-colors hover:text-primary sm:block"
            >
              Support
            </Link>
            <Link
              href="/offers"
              className="font-grotesk rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-6px_rgba(124,58,237,0.5)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
            >
              Accept offer
            </Link>
            <Link
              href="/cart"
              aria-label="Cart"
              className="relative flex h-10 w-10 items-center justify-center rounded-[10px] border border-search-border text-secondary transition-colors hover:text-primary"
            >
              <ShoppingCart size={18} />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 font-grotesk text-xs font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
            <ProfileMenu fullName={user.fullName} />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/partner"
              className="font-grotesk hidden text-sm font-medium text-secondary transition-colors hover:text-primary sm:block"
            >
              Become a partner
            </Link>
            <Link
              href="/sign-in"
              className="font-grotesk rounded-[10px] border border-search-border px-4 py-2.5 text-sm font-medium text-secondary transition-colors hover:bg-surface-2 hover:text-primary"
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
        )}
      </nav>
    </header>
  );
};
