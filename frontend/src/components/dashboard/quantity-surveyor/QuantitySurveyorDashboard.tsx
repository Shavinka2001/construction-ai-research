"use client";

import { Banknote, CalendarDays, TrendingUp } from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import { getDisplayName } from "@/lib/auth";
import { ROLE_DASHBOARD_LABELS } from "@/lib/roles";
import { BoqSheet } from "@/components/dashboard/quantity-surveyor/BoqSheet";
import { ProjectScheduleTimeline } from "@/components/dashboard/quantity-surveyor/ProjectScheduleTimeline";
import { cn } from "@/lib/utils";

type QuantitySurveyorDashboardProps = {
  user: AuthUser;
};

/** Soft 30-year OPEX sparkline (illustrative maintenance cost trend). */
function OpexSparkline() {
  const points = [28, 32, 30, 38, 42, 40, 48, 52, 50, 58, 62, 68];
  const width = 120;
  const height = 36;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;

  const linePoints = points.map((value, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return { x, y };
  });
  const polyline = linePoints.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath = [
    `M0,${height}`,
    ...linePoints.map((p) => `L${p.x},${p.y}`),
    `L${width},${height}`,
    "Z",
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-3 h-9 w-full max-w-[140px]"
      aria-hidden
    >
      <defs>
        <linearGradient id="opexFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#opexFill)" />
      <polyline
        points={polyline}
        fill="none"
        stroke="#D4AF37"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function QuantitySurveyorDashboard({
  user,
}: QuantitySurveyorDashboardProps) {
  const displayName = getDisplayName(user);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-luxury sm:p-8">
        <div
          className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold/5 blur-2xl"
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              {ROLE_DASHBOARD_LABELS.QUANTITY_SURVEYOR}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Cost &amp; Scheduling Intelligence
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500 sm:text-base">
            Welcome, {displayName}. Component 4 — automated BOQ estimating,
            live rate feeds, and CPM project scheduling.
          </p>
        </div>
      </header>

      {/* Financial metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* CAPEX */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury transition-shadow hover:shadow-luxury-lg sm:p-6">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Estimated Project Cost (CAPEX)
              </p>
              <p className="mt-2 flex flex-wrap items-baseline gap-1.5">
                <span className="text-sm font-bold tracking-wide text-gold">
                  LKR
                </span>
                <span className="text-3xl font-bold tabular-nums text-brand-primary">
                  18,450,000
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Aggregated from live BOQ rates
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <Banknote className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>

        {/* Duration */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury transition-shadow hover:shadow-luxury-lg sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Project Duration
              </p>
              <p className="mt-2 text-3xl font-bold text-brand-primary">
                120{" "}
                <span className="text-lg font-semibold text-slate-500">
                  Days
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Critical path · 4 milestone phases
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>

        {/* Lifecycle OPEX */}
        <div
          className={cn(
            "rounded-2xl border border-gold/30 bg-gradient-to-br from-white to-amber-50/40 p-5 shadow-luxury",
            "shadow-[0_0_20px_-8px_rgba(212,175,55,0.3)] transition-shadow hover:shadow-luxury-lg sm:col-span-2 sm:p-6 lg:col-span-1"
          )}
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                30-Year Lifecycle OPEX
              </p>
              <p className="mt-2 flex flex-wrap items-baseline gap-1.5">
                <span className="text-sm font-bold tracking-wide text-gold">
                  LKR
                </span>
                <span className="text-3xl font-bold tabular-nums text-brand-primary">
                  4,200,000
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Predicted maintenance &amp; operations
              </p>
              <OpexSparkline />
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <TrendingUp className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      {/* Estimating & scheduling workspace — 60% / 40% */}
      <div className="grid gap-6 lg:grid-cols-5 lg:gap-8">
        <div className="lg:col-span-3">
          <BoqSheet />
        </div>
        <div className="lg:col-span-2">
          <ProjectScheduleTimeline />
        </div>
      </div>
    </div>
  );
}
