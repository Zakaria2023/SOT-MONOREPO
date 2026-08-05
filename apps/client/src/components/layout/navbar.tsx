import { CartLink } from "@/components/layout/cart-link";
import { CategoryMenu } from "@/components/layout/category-menu";
import { GuestCartSync } from "@/components/layout/guest-cart-sync";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getCurrentUser } from "@/lib/auth";
import { buildCategoryTree } from "@/lib/categories";
import { getCachedCategories } from "@/lib/data";
import Link from "next/link";
import { getCartItemCount } from "services";

export const Navbar = async () => {
  const user = await getCurrentUser();
  const [categories, cartCount] = await Promise.all([
    getCachedCategories(),
    user ? getCartItemCount(user.uuid) : Promise.resolve(0),
  ]);
  const tree = buildCategoryTree(categories);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-page/80 shadow-[0_1px_3px_rgba(20,22,27,0.06)] backdrop-blur-xl">
      <nav className="mx-auto flex h-18 items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6 lg:px-12 xl:px-20">
        <Link
          href="/"
          className="font-heading shrink-0 text-xl text-ink sm:text-2xl"
        >
          SOT Solutions
        </Link>

        <CategoryMenu categories={tree} />

        {/* `shrink-0` + `whitespace-nowrap` throughout: without them the row's
            text wrapped inside the fixed h-18 and the labels collided. The
            secondary links drop away first as the viewport narrows, so the
            primary action and the cart always survive. */}
        {/* `shrink-0` + `whitespace-nowrap` throughout: without them the row's
            text wrapped inside the fixed h-18 and the labels collided. The
            secondary links drop away first as the viewport narrows, and what
            they leave behind is reachable from MobileNav rather than gone. */}
        {user ? (
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              href="/support"
              className="font-grotesk hidden text-sm font-medium whitespace-nowrap text-secondary transition-colors hover:text-primary lg:block"
            >
              Support
            </Link>
            <Link
              href="/offers"
              className="font-grotesk hidden rounded-[10px] bg-primary-solid px-4 py-2.5 text-sm font-bold whitespace-nowrap text-white shadow-[0_8px_20px_-6px_rgba(124,58,237,0.5)] transition-all hover:-translate-y-0.5 hover:bg-primary-solid-hover sm:block sm:px-5"
            >
              Accept offer
            </Link>
            <CartLink serverCount={cartCount} />
            <ProfileMenu fullName={user.fullName} />
            <MobileNav categories={tree} isSignedIn />
            <GuestCartSync />
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <CartLink serverCount={0} />
            <Link
              href="/partner"
              className="font-grotesk hidden text-sm font-medium whitespace-nowrap text-secondary transition-colors hover:text-primary lg:block"
            >
              Become a partner
            </Link>
            <Link
              href="/sign-in"
              className="font-grotesk hidden rounded-[10px] border border-search-border px-4 py-2.5 text-sm font-medium whitespace-nowrap text-secondary transition-colors hover:bg-surface-2 hover:text-primary lg:block"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="font-grotesk hidden rounded-[10px] bg-primary-solid px-3.5 py-2.5 text-sm font-bold whitespace-nowrap text-white shadow-[0_8px_20px_-6px_rgba(124,58,237,0.5)] transition-all hover:-translate-y-0.5 hover:bg-primary-solid-hover sm:block sm:px-5"
            >
              Sign up
            </Link>
            <MobileNav categories={tree} isSignedIn={false} />
          </div>
        )}
      </nav>
    </header>
  );
};
