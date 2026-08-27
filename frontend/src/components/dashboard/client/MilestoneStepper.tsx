"use client";

import {
  CheckCircle2,
  Circle,
  FileUp,
  MapPinned,
  Layers,
  Calculator,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StepStatus = "completed" | "active" | "pending";

type MilestoneStep = {
  id: number;
  label: string;
  description: string;
  status: StepStatus;
  icon: React.ComponentType<{ className?: string }>;
};

const STEPS: MilestoneStep[] = [
  {
    id: 1,
    label: "Document Upload",
    description: "Blueprints & site plans received",
    status: "completed",
    icon: FileUp,
  },
  {
    id: 2,
    label: "Topographical & Zoning Check",
    description: "AI terrain & land-use analysis in progress",
    status: "active",
    icon: MapPinned,
  },
  {
    id: 3,
    label: "Structural Clash Check",
    description: "Awaiting structural model review",
    status: "pending",
    icon: Layers,
  },
  {
    id: 4,
    label: "BOQ Costing & CPM Scheduling",
    description: "Cost & timeline forecasting queued",
    status: "pending",
    icon: Calculator,
  },
  {
    id: 5,
    label: "Submission for Municipal Approval",
    description: "Authority review package pending",
    status: "pending",
    icon: Building2,
  },
];

function StepIndicator({ status }: { status: StepStatus }) {
  if (status === "completed") {
    return <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />;
  }
  if (status === "active") {
    return (
      <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden>
        <span className="absolute h-5 w-5 animate-ping rounded-full bg-gold/30" />
        <span className="relative h-3 w-3 rounded-full bg-gold shadow-[0_0_12px_rgba(212,175,55,0.6)]" />
      </span>
    );
  }
  return <Circle className="h-5 w-5 text-slate-300" aria-hidden />;
}

export function MilestoneStepper() {
  return (
    <div className="w-full">
      {/* Desktop horizontal stepper */}
      <ol className="hidden lg:flex lg:items-start lg:justify-between lg:gap-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === STEPS.length - 1;

          return (
            <li key={step.id} className="relative flex flex-1 flex-col items-center">
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-[calc(50%+14px)] top-2.5 h-px w-[calc(100%-28px)]",
                    step.status === "completed" ? "bg-emerald-300" : "bg-slate-200"
                  )}
                  aria-hidden
                />
              )}
              <div
                className={cn(
                  "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border bg-white transition-all",
                  step.status === "completed" && "border-emerald-200",
                  step.status === "active" && "border-gold shadow-[0_0_0_4px_rgba(212,175,55,0.12)]",
                  step.status === "pending" && "border-slate-200"
                )}
              >
                <StepIndicator status={step.status} />
              </div>
              <div className="mt-3 flex flex-col items-center text-center">
                <Icon
                  className={cn(
                    "mb-1.5 h-4 w-4",
                    step.status === "active" ? "text-gold" : "text-slate-400"
                  )}
                  aria-hidden
                />
                <p
                  className={cn(
                    "text-xs font-semibold leading-tight",
                    step.status === "pending" ? "text-slate-400" : "text-slate-800"
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-1 max-w-[9rem] text-[10px] leading-snug text-slate-500">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Mobile vertical stepper */}
      <ol className="space-y-0 lg:hidden">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === STEPS.length - 1;

          return (
            <li key={step.id} className="relative flex gap-4">
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-[19px] top-10 h-[calc(100%-12px)] w-px",
                    step.status === "completed" ? "bg-emerald-300" : "bg-slate-200"
                  )}
                  aria-hidden
                />
              )}
              <div
                className={cn(
                  "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white",
                  step.status === "completed" && "border-emerald-200",
                  step.status === "active" && "border-gold shadow-[0_0_0_4px_rgba(212,175,55,0.12)]",
                  step.status === "pending" && "border-slate-200"
                )}
              >
                <StepIndicator status={step.status} />
              </div>
              <div className={cn("min-w-0 flex-1", !isLast && "pb-8")}>
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      step.status === "active" ? "text-gold" : "text-slate-400"
                    )}
                    aria-hidden
                  />
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      step.status === "pending" ? "text-slate-400" : "text-slate-800"
                    )}
                  >
                    {step.label}
                  </p>
                </div>
                <p className="mt-1 text-xs text-slate-500">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
