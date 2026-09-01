"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { useComplianceWorkflow } from "@/contexts/ComplianceWorkflowContext";
import { cn } from "@/lib/utils";

export function StepApprovalRoadmap() {
  const { zone, roadmap, activeRoadmapIndex, setActiveRoadmapIndex } =
    useComplianceWorkflow();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
          Step 2 · Dynamic Approval Roadmap
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">
          Auto-generated approval pathway
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {zone
            ? `Roadmap tailored for ${zone.label.toLowerCase()}. Select a step to preview the responsible authority in Step 4.`
            : "Complete Step 1 to generate your regulatory roadmap."}
        </p>
      </div>

      {roadmap.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
          No roadmap yet — drop a location pin first.
        </div>
      ) : (
        <ol className="relative space-y-0 border-l-2 border-slate-200 pl-6">
          {roadmap.map((step, index) => {
            const isActive = index === activeRoadmapIndex;
            const isPast = index < activeRoadmapIndex;

            return (
              <motion.li
                key={step.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08, duration: 0.3 }}
                className="relative pb-8 last:pb-0"
              >
                <span
                  className={cn(
                    "absolute -left-[1.55rem] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-white",
                    isActive && "border-blue-600",
                    isPast && "border-emerald-500",
                    !isActive && !isPast && "border-slate-300"
                  )}
                >
                  {isPast ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Circle
                      className={cn(
                        "h-2 w-2 fill-current",
                        isActive ? "text-blue-600" : "text-slate-300"
                      )}
                    />
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => setActiveRoadmapIndex(index)}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-all",
                    isActive
                      ? "border-blue-200 bg-blue-50/60 shadow-sm ring-1 ring-blue-100"
                      : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Step {index + 1}
                      </p>
                      <h3 className="mt-0.5 text-sm font-bold text-slate-900">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-blue-700">
                        {step.authority}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                      <Clock className="h-3 w-3" />~{step.estimatedDays}d
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {step.description}
                  </p>
                </button>
              </motion.li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
