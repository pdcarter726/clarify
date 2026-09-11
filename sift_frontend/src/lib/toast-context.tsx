"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastType = "success" | "error";

interface Toast {
  id: number;
  text: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  showMessage: (text: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Owns the active toast queue. `showMessage` appends a toast (defaulting to
 * type "error") and auto-removes it after 6s via `setTimeout`; ids are
 * generated from a monotonically increasing ref so removal always targets
 * the right toast even if several are queued.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showMessage = useCallback((text: string, type: ToastType = "error") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, text, type }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showMessage }}>
      {children}
    </ToastContext.Provider>
  );
}

/** Accesses the current `ToastContextValue`; throws if called outside `ToastProvider`. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
