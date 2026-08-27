"use client";

import {
  FileStack,
  AlertOctagon,
  Ruler,
  FolderKanban,
} from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import { getDisplayName } from "@/lib/auth";
import { ROLE_DASHBOARD_LABELS } from "@/lib/roles";
import { MilestoneStepper } from "@/components/dashboard/client/MilestoneStepper";
import { ProjectPortfolioBar } from "@/components/dashboard/architect/ProjectPortfolioBar";
import { useArchitectWorkspace } from "@/contexts/ArchitectWorkspaceContext";
import { cn } from "@/lib/utils";

type ArchitectDashboardProps = {
  user: AuthUser;
};

export function ArchitectDashboard({ user }: ArchitectDashboardProps) {
  const displayName = getDisplayName(user);
  const {
    activeProject,
    projectsList,
    hasLiveResult,
    clashes,
    elementsDetected,
    wallLengthFt,
  } = useArchitectWorkspace();

  const metrics = [
    {
      label: "Portfolio Projects",
      value: String(projectsList.length),
      sub: activeProject
        ? `Active: ${activeProject.name}`
        : "Create a project to begin",
      icon: FolderKanban,
      variant: "default" as const,
    },
    {
      label: "Detected Structural Clashes",
      value: String(clashes.length),
      sub: hasLiveResult ? "from latest analysis" : "awaiting blueprint run",
      icon: AlertOctagon,
      variant: "warning" as const,
    },
    {
      label: "Parsed Elements",
      value: hasLiveResult ? String(elementsDetected) : "—",
      sub: hasLiveResult
        ? `${wallLengthFt.toLocaleString()} ft wall length`
        : "open Blueprint Parser to extract",
      icon: hasLiveResult ? Ruler : FileStack,
      variant: "default" as const,
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome banner + project selector */}
      <header className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-luxury sm:p-8">
        <div
          className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold/5 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                {ROLE_DASHBOARD_LABELS.ARCHITECT} · Overview
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Welcome back, {displayName}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500 sm:text-base">
              Construction AI enterprise hub — manage your project portfolio,
              then jump into Blueprint Parser or Clash Detection from the
              sidebar.
            </p>
          </div>

          <ProjectPortfolioBar />
        </div>
      </header>

      {/* Overall project stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const isWarning = metric.variant === "warning";

          return (
            <div
              key={metric.label}
              className={cn(
                "rounded-2xl border p-5 shadow-luxury transition-shadow hover:shadow-luxury-lg sm:p-6",
                isWarning
                  ? "border-gold/30 bg-gradient-to-br from-white to-amber-50/40 shadow-[0_0_24px_-8px_rgba(239,68,68,0.2)]"
                  : "border-slate-100 bg-white"
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
                      isWarning ? "text-red-700" : "text-brand-primary"
                    )}
                  >
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{metric.sub}</p>
                </div>
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    isWarning ? "bg-red-50 text-red-600" : "bg-gold/10 text-gold"
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pre-Construction Milestone Stepper */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-luxury sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Project Lifecycle
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          Pre-Construction Milestone Stepper
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Track progress from document intake through municipal submission.
        </p>
        <div className="mt-6">
          <MilestoneStepper />
        </div>
      </section>
    </div>
  );
}
