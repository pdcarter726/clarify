"use client";

import { useToast } from "@/lib/toast-context";

/** Fixed-position stack rendering the active toasts from `useToast`; renders nothing when the queue is empty. */
export default function ToastViewport() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`w-full max-w-sm rounded-lg px-4 py-3 text-sm font-medium shadow-lg ring-1 ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-800"
              : "bg-red-50 text-red-800 ring-red-200 dark:bg-red-900/40 dark:text-red-200 dark:ring-red-800"
          }`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}
