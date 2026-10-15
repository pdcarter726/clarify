"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "clarify_theme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/**
 * Owns the light/dark theme: on mount, hydrates from `localStorage`
 * ("clarify_theme") or falls back to the OS `prefers-color-scheme`, then
 * toggles the `dark` class on `<html>` and persists future changes back to
 * `localStorage` via `toggleTheme`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    // localStorage/matchMedia only exist client-side, so the real theme can't be
    // known during SSR — this one-time sync-on-mount is the only way to hydrate it.
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial: Theme =
      stored ?? "light";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  function setTheme(next: Theme) {
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    setThemeState(next);
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Accesses the current `ThemeContextValue`; throws if called outside `ThemeProvider`. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
