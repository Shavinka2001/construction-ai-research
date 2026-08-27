"use client";

import type { AuthUser } from "@/lib/auth";
import { getDisplayName } from "@/lib/auth";
import { ROLE_DASHBOARD_LABELS } from "@/lib/roles";
import {
  FeasibilityGauge,
  FeasibilityMicroIndicators,
} from "@/components/dashboard/client/FeasibilityGauge";
import { MilestoneStepper } from "@/components/dashboard/client/MilestoneStepper";
import { QuickUploadSection } from "@/components/dashboard/client/QuickUploadSection";

type ClientDashboardProps = {
  user: AuthUser;
};

export function ClientDashboard({ user }: ClientDashboardProps) {
  const displayName = getDisplayName(user);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome Header */}
      <header className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-luxury sm:p-8">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold/5 blur-2xl" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                {ROLE_DASHBOARD_LABELS.CLIENT}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Welcome Back, {displayName}!
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500 sm:text-base">
              Your pre-construction feasibility pipeline is active. Track scores,
              milestones, and upload project documents in one place.
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Active Project
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900">Site Analysis #001</p>
          </div>
        </div>
      </header>

      {/* Section A: Feasibility Score */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-luxury sm:p-8">
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Feasibility Intelligence
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
              Property Feasibility Score
            </h2>
          </div>
          <p className="text-xs text-slate-500">Last updated · Just now</p>
        </div>

        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:gap-12">
          <div className="flex shrink-0 flex-col items-center">
            <FeasibilityGauge score={84} />
            <p className="mt-3 text-center text-sm font-medium text-slate-600">
              Strong feasibility — proceed with detailed review
            </p>
          </div>
          <div className="w-full flex-1">
            <FeasibilityMicroIndicators />
          </div>
        </div>
      </section>

      {/* Section B: Milestone Stepper */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-luxury sm:p-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Project Pipeline
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
            Pre-Construction Milestones
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Real-time progress across your feasibility workflow
          </p>
        </div>
        <MilestoneStepper />
      </section>

      {/* Section C: Quick Upload */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-luxury sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Quick Actions
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
            Documents &amp; Location
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload blueprints and pin your site coordinates
          </p>
        </div>
        <QuickUploadSection />
      </section>
    </div>
  );
}
