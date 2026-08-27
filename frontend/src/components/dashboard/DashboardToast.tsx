"use client";

import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error";

type DashboardToastProps = {
  open: boolean;
  message: string;
  tone?: ToastTone;
  onClose: () => void;
  durationMs?: number;
};

export function DashboardToast({
  open,
  message,
  tone = "success",
  onClose,
  durationMs = 4200,
}: DashboardToastProps) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [open, onClose, durationMs]);

  if (!open) return null;

  const isSuccess = tone === "success";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4 sm:bottom-8 sm:justify-end sm:pr-8"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-luxury-lg backdrop-blur-md",
          isSuccess
            ? "border-emerald-200/80 bg-white/95"
            : "border-red-200/80 bg-white/95"
        )}
      >
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            isSuccess ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
          )}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[10px] font-bold uppercase tracking-[0.18em]",
              isSuccess ? "text-emerald-700" : "text-red-700"
            )}
          >
            {isSuccess ? "Success" : "Error"}
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-800">{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
