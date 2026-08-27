"use client";

import { useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Wand2,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClashItem, ClashSeverity } from "@/lib/clash-detection";
import type { GcrRecommendation } from "@/lib/clash-detection";

export type { GcrRecommendation };

type GcrPanelProps = {
  clashes: ClashItem[];
  recommendations: GcrRecommendation[];
  hasLiveResult?: boolean;
  onApplyResolution: (recommendation: GcrRecommendation) => void;
  applyingId?: string | null;
};

type TabId = "clashes" | "gcr";

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

export function GcrPanel({
  clashes,
  recommendations,
  hasLiveResult = false,
  onApplyResolution,
  applyingId = null,
}: GcrPanelProps) {
  const [tab, setTab] = useState<TabId>("clashes");
  const unresolved = clashes.length;
  const pendingFixes = recommendations.filter((r) => !r.applied).length;

  return (
    <div className="flex h-full max-h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury lg:max-h-none">
      <div className="border-b border-slate-100 px-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Generative Clash Resolution
          </p>
          {hasLiveResult && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Live
            </span>
          )}
        </div>
        <h2 className="mt-1 text-lg font-bold text-slate-900">GCR Engine</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Detect conflicts · prescribe geometric fixes
        </p>

        <div
          role="tablist"
          className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "clashes"}
            onClick={() => setTab("clashes")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all",
              tab === "clashes"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Detected Clashes
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                tab === "clashes"
                  ? "bg-red-50 text-red-700"
                  : "bg-slate-200 text-slate-600"
              )}
            >
              {unresolved}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "gcr"}
            onClick={() => setTab("gcr")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all",
              tab === "gcr"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden />
            AI Generative Fixes
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                tab === "gcr"
                  ? "bg-gold/15 text-gold-dark"
                  : "bg-slate-200 text-slate-600"
              )}
            >
              {pendingFixes}
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5" role="tabpanel">
        {tab === "clashes" && (
          <>
            {clashes.length === 0 ? (
              <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  No clashes detected
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Run dual-plan analysis to populate this log.
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
                        {(clash.columnLabel || clash.openingLabel) && (
                          <p className="mt-1.5 text-[11px] font-medium text-slate-500">
                            {[clash.columnLabel, clash.openingLabel]
                              .filter(Boolean)
                              .join(" → ")}
                          </p>
                        )}
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">
                          {clash.description}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </>
        )}

        {tab === "gcr" && (
          <>
            {recommendations.length === 0 ? (
              <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-gold/30 bg-gold/[0.03] px-4 text-center">
                <Sparkles className="h-6 w-6 text-gold" aria-hidden />
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  No generative fixes yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  GCR prescriptions appear after clash detection.
                </p>
              </div>
            ) : (
              recommendations.map((rec, index) => {
                const isApplying = applyingId === rec.id;
                return (
                  <article
                    key={rec.id}
                    className={cn(
                      "rounded-xl border p-4 transition-all",
                      rec.applied
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-gold/25 bg-gradient-to-br from-white to-amber-50/40 shadow-[0_0_20px_-8px_rgba(212,175,55,0.3)]"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          rec.applied
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-gold/15 text-gold"
                        )}
                      >
                        {rec.applied ? (
                          <CheckCircle2 className="h-4 w-4" aria-hidden />
                        ) : (
                          <Wand2 className="h-4 w-4" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gold">
                          Recommendation #{String(index + 1).padStart(2, "0")}
                        </p>
                        <h3 className="mt-0.5 text-sm font-bold leading-snug text-slate-900">
                          {rec.title}
                        </h3>
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">
                          <span className="font-semibold text-slate-800">
                            AI Prescription:{" "}
                          </span>
                          {rec.prescription}
                        </p>

                        {(rec.status === "VERIFIED_SAFE" ||
                          rec.recalculatedOverlap === 0) && (
                          <p
                            className="mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-md border border-emerald-200/80 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-emerald-800"
                            title={rec.verificationLog}
                          >
                            <CheckCircle2
                              className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                              aria-hidden
                            />
                            <span>
                              Verification Status: Recalculated Overlap 0%
                              (Passed & Safe)
                            </span>
                          </p>
                        )}

                        {rec.applied ? (
                          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                            Applied on canvas
                          </p>
                        ) : (
                          <button
                            type="button"
                            disabled={isApplying}
                            onClick={() => onApplyResolution(rec)}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/15 px-3.5 py-2 text-xs font-bold text-gold-dark transition-all hover:bg-gold/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-60"
                          >
                            {isApplying ? (
                              <>
                                <Loader2
                                  className="h-3.5 w-3.5 animate-spin"
                                  aria-hidden
                                />
                                Simulating…
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                                Apply AI Resolution
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}
