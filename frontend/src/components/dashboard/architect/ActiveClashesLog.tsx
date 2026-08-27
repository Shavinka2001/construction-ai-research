"use client";

import { AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClashItem, ClashSeverity } from "@/lib/clash-detection";
import { DEFAULT_CLASHES } from "@/lib/clash-detection";

type ActiveClashesLogProps = {
  clashes?: ClashItem[];
  hasLiveResult?: boolean;
};

function SeverityBadge({ severity }: { severity: ClashSeverity }) {
  const isCritical = severity === "CRITICAL";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        isCritical
          ? "border border-red-200 bg-red-50 text-red-700"
          : "border border-amber-200 bg-amber-50 text-amber-800"
      )}
    >
      {severity}
    </span>
  );
}

export function ActiveClashesLog({
  clashes = DEFAULT_CLASHES,
  hasLiveResult = false,
}: ActiveClashesLogProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Clash Detection Engine
          </p>
          {hasLiveResult && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Updated
            </span>
          )}
        </div>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          Active Clashes Log
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {clashes.length} unresolved structural conflict
          {clashes.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        {clashes.length === 0 ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center">
            <p className="text-sm font-semibold text-slate-700">
              No clashes detected
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Upload both plans and run analysis to populate this log.
            </p>
          </div>
        ) : (
          clashes.map((clash) => {
            const isCritical = clash.severity === "CRITICAL";
            const Icon = isCritical ? AlertCircle : AlertTriangle;

            return (
              <article
                key={clash.id}
                className={cn(
                  "rounded-xl border p-4 transition-shadow hover:shadow-md",
                  isCritical
                    ? "border-red-100 bg-red-50/30 shadow-[0_0_20px_-6px_rgba(239,68,68,0.25)]"
                    : "border-amber-100 bg-amber-50/20 shadow-[0_0_16px_-6px_rgba(212,175,55,0.2)]"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      isCritical
                        ? "bg-red-100 text-red-600"
                        : "bg-amber-100 text-amber-700"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-snug text-slate-900">
                        {clash.title}
                      </h3>
                      <SeverityBadge severity={clash.severity} />
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      {clash.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
