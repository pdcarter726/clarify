"use client";

import { useTheme } from "@/lib/theme-context";

/** Sun/moon button that flips light/dark theme via `useTheme` (persisted to `localStorage` there). */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="flex h-9 w-9 items-center justify-center rounded-full text-lg transition-colors hover:bg-orange-100 dark:hover:bg-white/10"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
