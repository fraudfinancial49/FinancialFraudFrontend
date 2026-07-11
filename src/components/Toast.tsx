import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Loader2, XCircle, Info } from "lucide-react";

export type ToastVariant = "loading" | "success" | "error" | "info";

interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  pushToast: (variant: ToastVariant, message: string) => string;
  updateToast: (id: string, variant: ToastVariant, message: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function genToastId(): string {
  return `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Lightweight, dependency-free toast system (no external lib needed) so
// async admin actions (retrain, feedback submission, etc.) get consistent
// loading -> success/error visual feedback across the dashboard.
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = genToastId();
      setToasts((prev) => [...prev, { id, variant, message }]);
      if (variant !== "loading") {
        window.setTimeout(() => dismissToast(id), 5000);
      }
      return id;
    },
    [dismissToast]
  );

  const updateToast = useCallback(
    (id: string, variant: ToastVariant, message: string) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, variant, message } : t)));
      if (variant !== "loading") {
        window.setTimeout(() => dismissToast(id), 5000);
      }
    },
    [dismissToast]
  );

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, pushToast, updateToast, dismissToast }),
    [toasts, pushToast, updateToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg backdrop-blur-sm ${
              t.variant === "success"
                ? "border-risk-low/40 bg-vault-900/95 text-risk-low"
                : t.variant === "error"
                ? "border-risk-high/40 bg-vault-900/95 text-risk-high"
                : "border-vault-700 bg-vault-900/95 text-slate-200"
            }`}
          >
            {t.variant === "loading" && (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-accent-indigo" />
            )}
            {t.variant === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            {t.variant === "error" && <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            {t.variant === "info" && <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-teal" />}
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

export default ToastProvider;
