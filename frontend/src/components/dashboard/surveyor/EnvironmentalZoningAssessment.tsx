"use client";

import { useState } from "react";
import { CheckCircle2, Mountain, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

type AssessmentTab = "topography" | "zoning";

const TOPOGRAPHY_PARAMS = [
  { label: "Max Elevation", value: "45m", highlight: false },
  { label: "Min Elevation", value: "32m", highlight: false },
  {
    label: "Retaining Wall Required",
    value: "Yes",
    detail: "due to >15% slope in NW sector",
    highlight: true,
  },
  { label: "Average Slope", value: "14.5%", highlight: true },
  { label: "Drainage Gradient", value: "2.1% SE", highlight: false },
];

const ZONING_CHECKS = [
  { rule: "Front Setback", requirement: "3m", status: "PASSED" as const },
  { rule: "Side Setback", requirement: "1.5m", status: "PASSED" as const },
  { rule: "Rear Setback", requirement: "2m", status: "PASSED" as const },
  { rule: "Minimum Road Width", requirement: "12ft", status: "PASSED" as const },
  { rule: "Max Building Height", requirement: "12m", status: "PASSED" as const },
  { rule: "FAR Compliance", requirement: "0.65", status: "PASSED" as const },
];

const TABS: { id: AssessmentTab; label: string; icon: typeof Mountain }[] = [
  { id: "topography", label: "Topography Analysis", icon: Mountain },
  { id: "zoning", label: "Zoning Compliance", icon: Scale },
];

export function EnvironmentalZoningAssessment() {
  const [activeTab, setActiveTab] = useState<AssessmentTab>("topography");

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Site Intelligence
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          Environmental &amp; Zoning Assessment
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Terrain parameters · Municipal compliance
        </p>
      </div>

      {/* Tab switcher */}
      <div className="border-b border-slate-100 px-4 pt-4 sm:px-5">
        <div className="flex gap-1 rounded-xl border border-slate-100 bg-slate-50 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-all sm:gap-2 sm:px-3 sm:text-sm",
                  isActive
                    ? "bg-brand-primary text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {activeTab === "topography" ? (
          <div className="space-y-3">
            {TOPOGRAPHY_PARAMS.map((param) => (
              <div
                key={param.label}
                className={cn(
                  "rounded-xl border p-4",
                  param.highlight
                    ? "border-amber-200/80 bg-amber-50/40 shadow-[0_0_16px_-6px_rgba(212,175,55,0.25)]"
                    : "border-slate-100 bg-slate-50/50"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {param.label}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-lg font-bold",
                        param.highlight ? "text-amber-800" : "text-slate-900"
                      )}
                    >
                      {param.value}
                      {param.detail && (
                        <span className="ml-1 text-sm font-medium text-amber-700">
                          ({param.detail})
                        </span>
                      )}
                    </p>
                  </div>
                  {param.highlight && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <Mountain className="h-4 w-4" aria-hidden />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {ZONING_CHECKS.map((check) => (
              <li
                key={check.rule}
                className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/30 px-4 py-3.5 transition-shadow hover:shadow-sm"
              >
                <CheckCircle2
                  className="h-5 w-5 shrink-0 text-emerald-600"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{check.rule}</p>
                  <p className="text-xs text-slate-500">{check.requirement}</p>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  {check.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
