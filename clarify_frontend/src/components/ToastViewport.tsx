"use client";

import { useToast } from "@/lib/toast-context";
import Icon from "./Icon";

/** Fixed-position stack rendering the active toasts from `useToast`; renders nothing when the queue is empty. */
export default function ToastViewport() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === "error" ? "alert" : "status"}
          className={`rin pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-[15px] font-semibold ${
            toast.type === "success"
              ? "border-accent bg-hi text-on-hi"
              : "border-danger-line bg-surface text-danger"
          }`}
          style={{ boxShadow: "var(--shadow)" }}
        >
          <Icon name={toast.type === "success" ? "check" : "x"} size={18} className="mt-px shrink-0" />
          {toast.text}
        </div>
      ))}
    </div>
  );
}
