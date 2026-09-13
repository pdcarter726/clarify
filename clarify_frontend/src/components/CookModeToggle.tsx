"use client";

import { useWakeLock } from "@/lib/use-wake-lock";

/**
 * "Cook mode" switch: while on, keeps the device screen from going dark so
 * the recipe stays readable mid-cooking. Disabled (with an explanation) in
 * browsers without the Screen Wake Lock API.
 */
export default function CookModeToggle() {
  const { supported, enabled, error, toggle } = useWakeLock();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        disabled={!supported}
        title={
          supported
            ? "Keep the screen on while you cook"
            : "Cook mode isn't supported in this browser"
        }
        className="group inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white py-1 pl-3 pr-1 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
      >
        <span aria-hidden="true">🍳</span>
        Cook mode
        <span
          aria-hidden="true"
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            enabled ? "bg-orange-500" : "bg-zinc-300 dark:bg-white/20"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </span>
      </button>
      {enabled && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Screen will stay on
        </span>
      )}
      {!supported && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Not supported in this browser
        </span>
      )}
      {error && (
        <span role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </span>
      )}
    </div>
  );
}
