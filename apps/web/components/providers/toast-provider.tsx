"use client";

import * as React from "react";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, randomUuid } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  /**
   * R36 — optional inline action (e.g. Undo). When present the toast lingers a
   * little longer so there's time to act; clicking it runs `onClick` and
   * dismisses the toast.
   */
  action?: { label: string; onClick: () => void };
};

type ToastContextValue = {
  showToast: (toast: Omit<Toast, "id">) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const showToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = randomUuid();
    setToasts((current) => [...current, { ...toast, id }].slice(-3));
    window.setTimeout(
      () => setToasts((current) => current.filter((item) => item.id !== id)),
      toast.action ? 6000 : 4500
    );
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-20 right-4 z-50 grid w-[calc(100%-2rem)] gap-2 sm:bottom-4 sm:w-96">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "rounded-xl border bg-card p-4 text-card-foreground shadow-lg transition-all",
              toast.variant === "error" && "border-destructive/40",
              toast.variant === "success" && "border-primary/30"
            )}
            role="status"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2
                className={cn(
                  "mt-0.5 h-4 w-4 text-muted-foreground",
                  toast.variant === "success" && "text-primary",
                  toast.variant === "error" && "text-destructive"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{toast.description}</p>
                ) : null}
              </div>
              {toast.action ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 font-semibold text-primary"
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                >
                  {toast.action.label}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => dismiss(toast.id)}
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Dismiss notification</span>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}
