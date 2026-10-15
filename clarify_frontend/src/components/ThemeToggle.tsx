"use client";

import { useTheme } from "@/lib/theme-context";
import Icon from "./Icon";

/** Sun/moon button that flips light/dark theme via `useTheme` (persisted to `localStorage` there). */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button type="button" onClick={toggleTheme} aria-label={label} title={label} className="icon-btn">
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}
