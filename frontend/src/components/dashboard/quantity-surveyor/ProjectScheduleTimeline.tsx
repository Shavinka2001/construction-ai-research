"use client";

import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type PhaseStatus = "PASSED" | "IN_PROGRESS" | "QUEUED";

type SchedulePhase = {
  id: string;
  title: string;
  dayRange: string;
  progress: number;
  status: PhaseStatus;
};

const PHASES: SchedulePhase[] = [
  {
    id: "1",
    title: "Excavation & Foundation",
    dayRange: "Days 1 – 20",
    progress: 100,
    status: "PASSED",
  },
  {
    id: "2",
    title: "Reinforcement Concrete Frame",
    dayRange: "Days 21 – 60",
    progress: 55,
    status: "IN_PROGRESS",
  },
  {
    id: "3",
    title: "Masonry, Plumbing & Electrical",
    dayRange: "Days 61 – 90",
    progress: 0,
    status: "QUEUED",
  },
  {
    id: "4",
    title: "Tiling, Painting & Handover",
    dayRange: "Days 91 – 120",
    progress: 0,
    status: "QUEUED",
  },
];

function StatusIndicator({ status }: { status: PhaseStatus }) {
  if (status === "PASSED") {
    return (
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm"
        aria-label="Passed"
      >
        <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }

  if (status === "IN_PROGRESS") {
    return (
      <span
        className="relative flex h-8 w-8 items-center justify-center"
        aria-label="In progress"
      >
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/40" />
        <span className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-gold bg-gold/15">
          <span className="h-2.5 w-2.5 rounded-full bg-gold" />
        </span>
      </span>
    );
  }

  return (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-slate-300"
      aria-label="Queued"
    >
      <Circle className="h-3 w-3 fill-current" aria-hidden />
    </span>
  );
}

function StatusBadge({ status }: { status: PhaseStatus }) {
  const labels: Record<PhaseStatus, string> = {
    PASSED: "Passed",
    IN_PROGRESS: "In Progress",
    QUEUED: "Queued",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        status === "PASSED" &&
          "border border-emerald-200 bg-emerald-50 text-emerald-700",
        status === "IN_PROGRESS" &&
          "border border-gold/40 bg-gold/10 text-gold-dark",
        status === "QUEUED" &&
          "border border-slate-200 bg-slate-50 text-slate-500"
      )}
    >
      {labels[status]}
    </span>
  );
}

export function ProjectScheduleTimeline() {
  return (
    <div className="flex h-full max-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury lg:max-h-none">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Critical Path Method
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          Project Schedule
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          120-day CPM timeline · 4 milestone phases
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <ol className="relative space-y-0">
          {PHASES.map((phase, index) => {
            const isLast = index === PHASES.length - 1;
            const isActive = phase.status === "IN_PROGRESS";

            return (
              <li key={phase.id} className="relative flex gap-4 pb-8 last:pb-0">
                {!isLast && (
                  <span
                    className={cn(
                      "absolute left-[15px] top-8 w-0.5",
                      "bottom-0",
                      phase.status === "PASSED"
                        ? "bg-emerald-200"
                        : "bg-slate-200"
                    )}
                    aria-hidden
                  />
                )}

                <div className="relative z-10 shrink-0">
                  <StatusIndicator status={phase.status} />
                </div>

                <div
                  className={cn(
                    "min-w-0 flex-1 rounded-xl border p-4 transition-shadow",
                    isActive
                      ? "border-gold/30 bg-gradient-to-br from-white to-amber-50/40 shadow-[0_0_20px_-8px_rgba(212,175,55,0.35)]"
                      : "border-slate-100 bg-slate-50/50"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Phase {phase.id}
                      </p>
                      <h3 className="mt-0.5 text-sm font-bold text-slate-900">
                        {phase.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {phase.dayRange}
                      </p>
                    </div>
                    <StatusBadge status={phase.status} />
                  </div>

                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider">
                      <span className="text-slate-400">Duration</span>
                      <span
                        className={cn(
                          phase.status === "PASSED" && "text-emerald-600",
                          phase.status === "IN_PROGRESS" && "text-gold-dark",
                          phase.status === "QUEUED" && "text-slate-400"
                        )}
                      >
                        {phase.progress}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          phase.status === "PASSED" && "bg-emerald-500",
                          phase.status === "IN_PROGRESS" &&
                            "bg-gradient-to-r from-gold-dark to-gold",
                          phase.status === "QUEUED" && "bg-slate-300"
                        )}
                        style={{ width: `${phase.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
