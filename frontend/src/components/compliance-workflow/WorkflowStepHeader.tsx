"use client";

import { cn } from "@/lib/utils";
import type { WorkflowStepIndex } from "@/contexts/ComplianceWorkflowContext";

const STEPS: { id: WorkflowStepIndex; label: string; subtitle: string }[] = [
  { id: 1, label: "Location", subtitle: "Geospatial ID" },
  { id: 2, label: "Roadmap", subtitle: "Approval path" },
  { id: 3, label: "Documents", subtitle: "ML verification" },
  { id: 4, label: "Authority", subtitle: "Officer routing" },
];

type WorkflowStepHeaderProps = {
  currentStep: WorkflowStepIndex;
  onStepClick?: (step: WorkflowStepIndex) => void;
};

export function WorkflowStepHeader({
  currentStep,
  onStepClick,
}: WorkflowStepHeaderProps) {
  return (
    <nav
      aria-label="Compliance workflow progress"
      className="flex flex-wrap items-center gap-2 sm:gap-0"
    >
      {STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        const isComplete = step.id < currentStep;

        return (
          <div key={step.id} className="flex items-center">
            <button
              type="button"
              onClick={() => onStepClick?.(step.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors sm:px-4",
                isActive && "bg-slate-900 text-white shadow-md",
                !isActive &&
                  isComplete &&
                  "bg-slate-100 text-slate-700 hover:bg-slate-200",
                !isActive &&
                  !isComplete &&
                  "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isActive && "bg-blue-500 text-white",
                  !isActive && isComplete && "bg-emerald-500 text-white",
                  !isActive && !isComplete && "border border-slate-200 bg-white"
                )}
              >
                {isComplete ? "✓" : step.id}
              </span>
              <span className="hidden sm:block">
                <span className="block text-xs font-bold">{step.label}</span>
                <span
                  className={cn(
                    "block text-[10px]",
                    isActive ? "text-slate-300" : "text-slate-400"
                  )}
                >
                  {step.subtitle}
                </span>
              </span>
            </button>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1 hidden h-px w-6 sm:block sm:w-10",
                  step.id < currentStep ? "bg-emerald-400" : "bg-slate-200"
                )}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
