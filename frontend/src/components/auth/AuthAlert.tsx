"use client";

import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthAlertProps = {
  message: string;
  details?: string[];
  onDismiss?: () => void;
  variant?: "error" | "success";
};

export function AuthAlert({
  message,
  details = [],
  onDismiss,
  variant = "error",
}: AuthAlertProps) {
  const isError = variant === "error";

  return (
    <div
      role="alert"
      className={cn(
        "mb-6 flex gap-3 rounded-xl border px-4 py-3",
        isError
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{message}</p>
        {details.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {details.map((detail) => (
              <li key={detail} className="text-xs opacity-90">
                {detail}
              </li>
            ))}
          </ul>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
