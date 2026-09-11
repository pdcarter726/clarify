"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Avatar dropdown for the signed-in user (renders nothing when logged out).
 * Closes itself on an outside click or Escape, and on logout clears the
 * session (via `useAuth`) and redirects to `/`.
 */
export default function AccountMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleLogout() {
    setOpen(false);
    logout();
    router.push("/");
  }

  if (!user) return null;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title={user.email}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-base text-orange-800 transition-colors hover:bg-orange-200 dark:bg-white/10 dark:text-orange-200 dark:hover:bg-white/20"
      >
        👤
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-orange-100 bg-white py-1 shadow-lg shadow-orange-900/10 dark:border-white/10 dark:bg-[#211c2e]"
        >
          <p className="truncate border-b border-orange-100 px-3 py-2 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
            {user.email}
          </p>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-orange-50 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white"
          >
            Account settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="block w-full px-3 py-2 text-left text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
