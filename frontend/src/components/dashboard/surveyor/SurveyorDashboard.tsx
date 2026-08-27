"use client";

import { MapPinned, TrendingUp, AlertTriangle } from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import { getDisplayName } from "@/lib/auth";
import { ROLE_DASHBOARD_LABELS } from "@/lib/roles";
import { GisMapCanvas } from "@/components/dashboard/surveyor/GisMapCanvas";
import { EnvironmentalZoningAssessment } from "@/components/dashboard/surveyor/EnvironmentalZoningAssessment";
import { cn } from "@/lib/utils";

type SurveyorDashboardProps = {
  user: AuthUser;
};

const METRICS = [
  {
    label: "Analyzed Land Sites",
    value: "12",
    sub: "sites processed",
    icon: MapPinned,
    variant: "default" as const,
  },
  {
    label: "Average Terrain Slope",
    value: "14.5%",
    sub: "steep areas flagged in NW sector",
    icon: TrendingUp,
    variant: "slope" as const,
  },
  {
    label: "Active Environmental Flags",
    value: "1",
    sub: "Flood Zone detected",
    icon: AlertTriangle,
    variant: "environment" as const,
  },
];

export function SurveyorDashboard({ user }: SurveyorDashboardProps) {
  const displayName = getDisplayName(user);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-luxury sm:p-8">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold/5 blur-2xl" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              {ROLE_DASHBOARD_LABELS.SURVEYOR}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Geospatial Intelligence Hub
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500 sm:text-base">
            Welcome, {displayName}. Component 1 — automated site analysis, terrain
            modeling, and environmental hazard flagging.
          </p>
        </div>
      </header>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {METRICS.map((metric) => {
          const Icon = metric.icon;
          const isSlope = metric.variant === "slope";
          const isEnvironment = metric.variant === "environment";

          return (
            <div
              key={metric.label}
              className={cn(
                "rounded-2xl border p-5 shadow-luxury transition-shadow hover:shadow-luxury-lg sm:p-6",
                isSlope &&
                  "border-gold/30 bg-gradient-to-br from-white to-amber-50/30 shadow-[0_0_20px_-8px_rgba(212,175,55,0.3)]",
                isEnvironment &&
                  "border-amber-200/60 bg-gradient-to-br from-white to-amber-50/40 shadow-[0_0_20px_-8px_rgba(245,158,11,0.2)]",
                !isSlope && !isEnvironment && "border-slate-100 bg-white"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {metric.label}
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-3xl font-bold",
                      isSlope && "text-gold",
                      isEnvironment && "text-amber-800",
                      !isSlope && !isEnvironment && "text-brand-primary"
                    )}
                  >
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{metric.sub}</p>
                  {isEnvironment && (
                    <span className="mt-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Flood Zone
                    </span>
                  )}
                  {isSlope && (
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gold">
                      <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                      Steep terrain alert
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    isSlope && "bg-gold/15 text-gold",
                    isEnvironment && "bg-amber-100 text-amber-700",
                    !isSlope && !isEnvironment && "bg-gold/10 text-gold"
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two-column GIS workspace */}
      <div className="grid gap-6 lg:grid-cols-5 lg:gap-8">
        <div className="lg:col-span-3">
          <GisMapCanvas />
        </div>
        <div className="lg:col-span-2">
          <EnvironmentalZoningAssessment />
        </div>
      </div>
    </div>
  );
}
