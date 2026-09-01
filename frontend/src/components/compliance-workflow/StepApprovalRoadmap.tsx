"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Route,
} from "lucide-react";
import { useWorkflowRoadmap } from "@/contexts/ComplianceWorkflowContext";
import type { RoadmapStepStatus } from "@/lib/compliance-workflow/types";
import { cn } from "@/lib/utils";

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20, scale: 0.97 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 340, damping: 28 },
  },
};

const STATUS_STYLES: Record<
  RoadmapStepStatus,
  { label: string; className: string; icon?: "check" | "alert" | "spin" }
> = {
  pending: {
    label: "Pending",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  in_review: {
    label: "ML Review",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: "spin",
  },
  verified: {
    label: "Verified",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: "check",
  },
  flagged: {
    label: "Flagged",
    className: "bg-amber-50 text-amber-800 border-amber-200",
    icon: "alert",
  },
};

function StatusBadge({ status }: { status: RoadmapStepStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        style.className
      )}
    >
      {style.icon === "spin" && (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      )}
      {style.icon === "check" && (
        <CheckCircle2 className="h-3 w-3" aria-hidden />
      )}
      {style.icon === "alert" && (
        <AlertTriangle className="h-3 w-3" aria-hidden />
      )}
      {style.label}
    </span>
  );
}

export function StepApprovalRoadmap() {
  const {
    zone,
    roadmap,
    roadmapGeneration,
    activeRoadmapIndex,
    setActiveRoadmapIndex,
  } = useWorkflowRoadmap();

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
            ? `Tailored for ${zone.label}. Upload documents in Step 3 to update each phase status.`
            : "Complete Step 1 to generate your regulatory roadmap."}
        </p>
      </div>

      {zone && roadmap.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3"
        >
          <Route className="h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Zone-linked roadmap
            </p>
            <p className="text-sm font-medium text-slate-800">
              {roadmap.length} phase{roadmap.length !== 1 ? "s" : ""} ·{" "}
              {zone.matchedRule}
            </p>
          </div>
        </motion.div>
      )}

      {roadmap.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
          No roadmap yet — confirm a location pin in Step 1 to run zone detection.
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.ol
            key={roadmapGeneration}
            variants={listVariants}
            initial="hidden"
            animate="visible"
            className="relative space-y-0 border-l-2 border-slate-200 pl-6"
          >
            {roadmap.map((step, index) => {
              const isActive = index === activeRoadmapIndex;
              const isPast =
                index < activeRoadmapIndex || step.status === "verified";

              return (
                <motion.li
                  key={step.id}
                  variants={itemVariants}
                  className="relative pb-8 last:pb-0"
                >
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15 + index * 0.12, type: "spring" }}
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
                  </motion.span>

                  <motion.button
                    type="button"
                    onClick={() => setActiveRoadmapIndex(index)}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.995 }}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-colors",
                      isActive
                        ? "border-blue-200 bg-blue-50/60 shadow-sm ring-1 ring-blue-100"
                        : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm",
                      step.status === "flagged" &&
                        "border-amber-200/80 bg-amber-50/30"
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Phase {step.phase}
                        </p>
                        <h3 className="mt-0.5 text-sm font-bold text-slate-900">
                          {step.title}
                        </h3>
                        <p className="mt-1 text-xs font-medium text-blue-700">
                          {step.authority}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <StatusBadge status={step.status} />
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                          <Clock className="h-3 w-3" />~{step.estimatedDays}d
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      {step.description}
                    </p>
                    {step.statusNote && (
                      <p
                        className={cn(
                          "mt-2 text-[11px] font-medium",
                          step.status === "flagged"
                            ? "text-amber-800"
                            : step.status === "verified"
                              ? "text-emerald-700"
                              : "text-blue-700"
                        )}
                      >
                        {step.statusNote}
                      </p>
                    )}
                  </motion.button>
                </motion.li>
              );
            })}
          </motion.ol>
        </AnimatePresence>
      )}
    </div>
  );
}
