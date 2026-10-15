"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Icon from "./Icon";

/**
 * "Account" nav item for the signed-in user (renders nothing when logged out),
 * opening a dropdown with settings and log out. Closes itself on an outside
 * click or Escape, and on logout clears the session (via `useAuth`) and
 * redirects to `/`.
 */
export default function AccountMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
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
        title={user.email}
        className={`navitem ${pathname === "/account" ? "navitem-on" : ""}`}
      >
        <Icon name="user" />
        Account
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface py-1"
          style={{ boxShadow: "var(--shadow)" }}
        >
          <p className="truncate border-b border-line px-4 py-2.5 text-[13px] text-muted">
            {user.email}
          </p>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center px-4 text-[15px] font-semibold hover:bg-sunk"
          >
            Account settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex min-h-11 w-full items-center px-4 text-left text-[15px] font-semibold text-danger hover:bg-sunk"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
