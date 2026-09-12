"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AccountMenu from "./AccountMenu";
import ThemeToggle from "./ThemeToggle";
import { primaryButtonClass, secondaryButtonClass } from "./ui";

/**
 * Top nav bar. Switches its right-hand content based on auth state: signed-in
 * users get recipe/tag links plus the account menu, signed-out users get
 * log in/sign up buttons. Highlights the current route via `usePathname`.
 */
export default function Navbar() {
  const { user } = useAuth();
  const pathname = usePathname();

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        pathname === href
          ? "bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200"
          : "text-zinc-600 hover:bg-orange-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="border-b border-orange-100 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-[#17141f]/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href={user ? "/recipes" : "/"} className="flex items-center gap-2">
          <span className="text-xl">🥄</span>
          <span className="bg-gradient-to-r from-orange-600 to-rose-500 bg-clip-text text-lg font-bold tracking-tight text-transparent dark:from-orange-400 dark:to-rose-300">
            Clarify
          </span>
        </Link>

        {user ? (
          <nav className="flex items-center gap-1 sm:gap-2">
            {navLink("/recipes", "Recipes")}
            {navLink("/recipes/new", "New Recipe")}
            {navLink("/tags", "Tags")}
            <ThemeToggle />
            <AccountMenu />
          </nav>
        ) : (
          <nav className="flex items-center gap-2">
            <Link href="/login" className={secondaryButtonClass}>
              Log in
            </Link>
            <Link href="/login?tab=signup" className={primaryButtonClass}>
              Sign up
            </Link>
            <ThemeToggle />
          </nav>
        )}
      </div>
    </header>
  );
}
