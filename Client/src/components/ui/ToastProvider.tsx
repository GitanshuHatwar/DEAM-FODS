import React, { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "warning" | "error" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles: Record<
  ToastType,
  { icon: React.ReactNode; border: string; badge: string }
> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5 text-[#16A36A]" />,
    border: "border-[#16A36A]/30",
    badge: "bg-[#E8F3EF]",
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-[#D99A45]" />,
    border: "border-[#D99A45]/35",
    badge: "bg-[#F4ECE1]",
  },
  error: {
    icon: <AlertCircle className="h-5 w-5 text-[#DC6464]" />,
    border: "border-[#DC6464]/35",
    badge: "bg-[#DC6464]/10",
  },
  info: {
    icon: <Info className="h-5 w-5 text-[#648DAA]" />,
    border: "border-[#648DAA]/35",
    badge: "bg-[#648DAA]/10",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (item: Omit<ToastItem, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { ...item, id }]);
      window.setTimeout(() => removeToast(id), 4500);
    },
    [removeToast],
  );

  const value: ToastContextValue = {
    toast,
    success: (title, description) => toast({ type: "success", title, description }),
    error: (title, description) => toast({ type: "error", title, description }),
    warning: (title, description) => toast({ type: "warning", title, description }),
    info: (title, description) => toast({ type: "info", title, description }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((item) => {
            const style = toastStyles[item.type];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                className={cn(
                  "pointer-events-auto glass-panel flex items-start gap-3 rounded-2xl p-3.5",
                  style.border,
                )}
              >
                <div className={cn("rounded-xl p-1.5 shrink-0", style.badge)}>
                  {style.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#0F172A]">
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="mt-0.5 text-xs text-[#6B7280] leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(item.id)}
                  className="rounded-lg p-1 text-[#6B7280] hover:bg-[#F8F6F3] hover:text-[#0F172A]"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
