"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AccountMenu from "./AccountMenu";
import Icon, { type IconName } from "./Icon";
import Logo from "./Logo";

const NAV_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/recipes", label: "Recipes", icon: "list" },
  { href: "/recipes/new", label: "New recipe", icon: "plus" },
  { href: "/tags", label: "Tags", icon: "tag" },
];

/**
 * Top nav bar. Switches its content based on auth state: signed-in users get
 * recipe/tag links plus the account menu, signed-out users get log in/sign up
 * buttons. Highlights the current route via `usePathname`. Hidden on `/login`,
 * which has its own split-screen layout.
 */
export default function Navbar() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <header className="border-b border-line bg-surface">
      <div className="wrap flex flex-wrap items-center justify-between gap-x-7 gap-y-3 py-2.5">
        <Logo href={user ? "/recipes" : "/"} />

        {user ? (
          <>
            <nav className="mr-auto flex flex-wrap gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={`navitem ${pathname === item.href ? "navitem-on" : ""}`}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </nav>
            <AccountMenu />
          </>
        ) : (
          <nav className="flex flex-wrap items-center gap-2">
            <Link href="/login" className="btn">
              Log in
            </Link>
            <Link href="/login?tab=signup" className="btn btn-primary">
              Sign up
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
