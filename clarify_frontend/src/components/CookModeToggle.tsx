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
    <div className="flex flex-col items-end gap-2">
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
        className="switch"
      >
        Cook mode
        <span aria-hidden="true" className="switch-track" data-on={enabled}>
          <span className="switch-knob" />
        </span>
      </button>
      {enabled && <span className="text-[13px] text-muted">Screen will stay on</span>}
      {!supported && <span className="text-[13px] text-muted">Not supported in this browser</span>}
      {error && (
        <span role="alert" className="text-[13px] text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
